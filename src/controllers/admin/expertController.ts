import Expert from "../../models/Expert";
import BankAccount from "../../models/BankAccount";
import Payment from "../../models/Payment";
import Admin from "../../models/Admin";
import { asyncHandler } from "../../middlewares/errorHandler";
import {
  checkEmailExists,
  checkPhoneExists,
} from "../../utils/emailValidation";

// Helper: get GLOBAL admin commission rate (the platform default).
// Individual experts can override this via Expert.commissionRate.
const DEFAULT_COMMISSION_RATE = 15;
const getCommissionRate = async (): Promise<number> => {
  const admin = await Admin.findOne({ role: "superadmin" }).select(
    "commissionRate",
  );
  if (admin && typeof admin.commissionRate === "number")
    return admin.commissionRate;
  const anyAdmin = await Admin.findOne().select("commissionRate");
  return anyAdmin?.commissionRate ?? DEFAULT_COMMISSION_RATE;
};

// Resolve the effective rate for one expert (override → global default).
const resolveExpertRate = (
  expertRate: number | null | undefined,
  globalRate: number,
): number => (typeof expertRate === "number" ? expertRate : globalRate);

// Get expert statistics
const getExpertStats = asyncHandler(async (req, res) => {
  try {
    const totalExperts = await Expert.countDocuments();
    const activeExperts = await Expert.countDocuments({ isActive: true });
    const inactiveExperts = await Expert.countDocuments({ isActive: false });
    const verifiedExperts = await Expert.countDocuments({ isVerified: true });

    // Calculate average rating across all experts
    const ratingStats = await Expert.aggregate([
      {
        $match: {
          "rating.count": { $gt: 0 },
        },
      },
      {
        $group: {
          _id: null,
          totalRating: {
            $sum: { $multiply: ["$rating.average", "$rating.count"] },
          },
          totalCount: { $sum: "$rating.count" },
          expertCount: { $sum: 1 },
        },
      },
    ]);

    let averageRating = 0;
    if (ratingStats.length > 0 && ratingStats[0].totalCount > 0) {
      averageRating = ratingStats[0].totalRating / ratingStats[0].totalCount;
    }

    // Per-expert revenue, then apply each expert's effective commission rate.
    const commissionRate = await getCommissionRate();
    const perExpertRevenue = await Payment.aggregate([
      {
        $match: {
          status: "completed",
          expert: { $exists: true, $ne: null },
        },
      },
      { $group: { _id: "$expert", revenue: { $sum: "$amount" } } },
      {
        $lookup: {
          from: "experts",
          localField: "_id",
          foreignField: "_id",
          as: "expertInfo",
        },
      },
      { $unwind: { path: "$expertInfo", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          revenue: 1,
          expertRate: "$expertInfo.commissionRate",
        },
      },
    ]);

    let totalRevenue = 0;
    let totalCommission = 0;
    for (const row of perExpertRevenue) {
      const rate = resolveExpertRate(row.expertRate, commissionRate);
      totalRevenue += row.revenue;
      totalCommission += Math.round((row.revenue * rate) / 100);
    }

    res.status(200).json({
      success: true,
      data: {
        stats: {
          totalExperts,
          activeExperts,
          inactiveExperts,
          verifiedExperts,
          averageRating: Math.round(averageRating * 10) / 10,
          totalRevenue,
          totalCommission,
          commissionRate,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch expert statistics",
    });
  }
});

// Get all experts
const getExperts = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search,
    status,
    verificationStatus,
    specialty,
    startDate,
    endDate,
  } = req.query;

  const query: Record<string, unknown> = {};

  // Add search functionality
  if (search) {
    query.$or = [
      { firstName: { $regex: search, $options: "i" } },
      { lastName: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
      { specialization: { $regex: search, $options: "i" } },
    ];
  }

  // Add status filter
  if (status && status !== "all" && ["active", "inactive"].includes(status)) {
    query.isActive = status === "active";
  }

  // Add verification status filter
  if (verificationStatus && verificationStatus !== "all") {
    if (
      ["pending", "under_review", "approved", "rejected"].includes(
        verificationStatus,
      )
    ) {
      query.verificationStatus = verificationStatus;
    }
  }

  // Add specialty filter
  if (specialty && specialty !== "all") {
    query.specialization = { $regex: specialty, $options: "i" };
  }

  // Date range filter (for expert registration date)
  if (startDate || endDate) {
    const dateFilter: { $gte?: Date; $lte?: Date } = {};
    if (startDate) {
      dateFilter.$gte = new Date(startDate as string);
    }
    if (endDate) {
      const end = new Date(endDate as string);
      end.setHours(23, 59, 59, 999); // Include the entire end date
      dateFilter.$lte = end;
    }
    query.createdAt = dateFilter;
  }

  const pageNumber = Number(page) || 1;
  const limitNumber = Number(limit) || 10;
  const skip = (pageNumber - 1) * limitNumber;

  const experts = await Expert.find(query)
    .select("-password")
    .sort({ createdAt: -1 })
    .limit(limitNumber)
    .skip(skip);

  // Transform experts to include status field
  const transformedExperts = experts.map((expert) => ({
    ...expert.toObject(),
    id: expert._id.toString(),
    status: expert.isActive ? "active" : "inactive",
  }));

  const total = await Expert.countDocuments(query);

  res.status(200).json({
    success: true,
    data: {
      experts: transformedExperts,
      pagination: {
        current: pageNumber,
        pages: Math.ceil(total / limitNumber),
        total,
      },
    },
  });
});

// Get expert by ID
const getExpertById = asyncHandler(async (req, res) => {
  const expert = await Expert.findById(req.params.id).select("-password");

  if (!expert) {
    return res.status(404).json({
      success: false,
      message: "Expert not found",
    });
  }

  // Fetch bank account details for the expert
  const bankAccount = await BankAccount.findOne({ expert: expert._id });

  const expertData: any = expert.toObject();
  if (bankAccount) {
    expertData.bankAccount = bankAccount;
  }

  res.status(200).json({
    success: true,
    data: { expert: expertData },
  });
});

// Create new expert
const createExpert = asyncHandler(async (req, res) => {
  const {
    name,
    firstName,
    lastName,
    email,
    phone,
    password,
    specialization,
    experience,
    bio,
    hourlyRate,
    availability,
  } = req.body;

  if (!email || !password || !specialization) {
    return res.status(400).json({
      success: false,
      message: "Email, password, and specialization are required",
    });
  }

  // Handle name vs firstName/lastName
  let expertFirstName = firstName;
  let expertLastName = lastName;

  if (name && !firstName && !lastName) {
    const nameParts = name.trim().split(" ");
    expertFirstName = nameParts[0];
    expertLastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";
  }

  if (!expertFirstName) {
    return res.status(400).json({
      success: false,
      message: "First name is required",
    });
  }

  // Check if email already exists in either User or Expert collection
  const emailCheck = await checkEmailExists(email);
  if (emailCheck.exists) {
    return res.status(400).json({
      success: false,
      message: emailCheck.message,
    });
  }

  const expert = await Expert.create({
    firstName: expertFirstName,
    lastName: expertLastName || "",
    email,
    phone,
    password,
    specialization,
    experience: experience || 0,
    bio: bio || "",
    hourlyRate: hourlyRate || 0,
    availability: availability || [],
    isActive: true,
    isVerified: false,
  });

  res.status(201).json({
    success: true,
    data: { expert: { ...expert.toObject(), password: undefined } },
  });
});

// Update expert
const updateExpert = asyncHandler(async (req, res) => {
  const {
    name,
    firstName,
    lastName,
    email,
    phone,
    specialization,
    experience,
    bio,
    hourlyRate,
    availability,
    isActive,
    isVerified,
    verificationStatus,
  } = req.body;

  const expert = await Expert.findById(req.params.id);

  if (!expert) {
    return res.status(404).json({
      success: false,
      message: "Expert not found",
    });
  }

  // Check if email is already taken by another expert or user
  if (email && email !== expert.email) {
    const emailCheck = await checkEmailExists(email);
    if (emailCheck.exists) {
      return res.status(400).json({
        success: false,
        message: emailCheck.message,
      });
    }
  }

  // Handle name vs firstName/lastName
  if (name && !firstName && !lastName) {
    const nameParts = name.trim().split(" ");
    expert.firstName = nameParts[0];
    expert.lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";
  } else {
    if (firstName) expert.firstName = firstName;
    if (lastName !== undefined) expert.lastName = lastName;
  }

  // Update other fields
  if (email) expert.email = email;
  if (phone !== undefined) expert.phone = phone;
  if (specialization) expert.specialization = specialization;
  if (typeof experience === "number") expert.experience = experience;
  if (bio !== undefined) expert.bio = bio;
  if (typeof hourlyRate === "number") expert.hourlyRate = hourlyRate;
  if (availability) expert.availability = availability;
  if (typeof isActive === "boolean") expert.isActive = isActive;

  // Handle verification status
  if (verificationStatus) {
    expert.verificationStatus = verificationStatus;
    expert.isVerified = verificationStatus === "approved";
  } else if (typeof isVerified === "boolean") {
    expert.isVerified = isVerified;
    // Optionally, you might want to sync verificationStatus here as well
    if (isVerified && expert.verificationStatus !== "approved") {
      expert.verificationStatus = "approved";
    } else if (!isVerified && expert.verificationStatus === "approved") {
      expert.verificationStatus = "pending"; // Or another default
    }
  }

  await expert.save();

  res.status(200).json({
    success: true,
    data: { expert: { ...expert.toObject(), password: undefined } },
  });
});

// Delete expert
const deleteExpert = asyncHandler(async (req, res) => {
  const expert = await Expert.findById(req.params.id);

  if (!expert) {
    return res.status(404).json({
      success: false,
      message: "Expert not found",
    });
  }

  await Expert.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    message: "Expert deleted successfully",
  });
});

// Toggle expert status
const toggleExpertStatus = asyncHandler(async (req, res) => {
  try {
    console.log("Toggle expert status called with ID:", req.params.id);

    const expert = await Expert.findById(req.params.id);

    if (!expert) {
      console.log("Expert not found with ID:", req.params.id);
      return res.status(404).json({
        success: false,
        message: "Expert not found",
      });
    }

    const previousStatus = expert.isActive;
    expert.isActive = !expert.isActive;
    await expert.save();

    console.log(
      `Expert ${expert.email} status changed from ${previousStatus} to ${expert.isActive}`,
    );

    // Return expert with proper format
    const transformedExpert = {
      ...expert.toObject(),
      id: expert._id.toString(),
      status: expert.isActive ? "active" : "inactive",
      password: undefined,
    };

    res.status(200).json({
      success: true,
      message: `Expert ${expert.isActive ? "activated" : "deactivated"} successfully`,
      data: { expert: transformedExpert },
    });
  } catch (error) {
    console.error("Error toggling expert status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to toggle expert status",
    });
  }
});

// Toggle expert verification
const toggleExpertVerification = asyncHandler(async (req, res) => {
  try {
    console.log("Toggle expert verification called with ID:", req.params.id);

    const expert = await Expert.findById(req.params.id);

    if (!expert) {
      console.log("Expert not found with ID:", req.params.id);
      return res.status(404).json({
        success: false,
        message: "Expert not found",
      });
    }

    const previousVerification = expert.isVerified;
    expert.isVerified = !expert.isVerified;
    await expert.save();

    console.log(
      `Expert ${expert.email} verification changed from ${previousVerification} to ${expert.isVerified}`,
    );

    res.status(200).json({
      success: true,
      message: `Expert ${expert.isVerified ? "verified" : "unverified"} successfully`,
      data: { expert: { ...expert.toObject(), password: undefined } },
    });
  } catch (error) {
    console.error("Error toggling expert verification:", error);
    res.status(500).json({
      success: false,
      message: "Failed to toggle expert verification",
    });
  }
});

// Get per-expert earnings with admin commission breakdown
const getExpertEarnings = asyncHandler(async (req, res) => {
  try {
    const commissionRate = await getCommissionRate();

    // Aggregate payments grouped by expert
    const earningsPerExpert = await Payment.aggregate([
      {
        $match: {
          status: "completed",
          expert: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: "$expert",
          totalAmount: { $sum: "$amount" },
          sessionCount: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "experts",
          localField: "_id",
          foreignField: "_id",
          as: "expertInfo",
        },
      },
      {
        $unwind: { path: "$expertInfo", preserveNullAndEmptyArrays: false },
      },
      {
        $project: {
          expertId: "$_id",
          totalAmount: 1,
          sessionCount: 1,
          name: {
            $concat: [
              { $ifNull: ["$expertInfo.firstName", ""] },
              " ",
              { $ifNull: ["$expertInfo.lastName", ""] },
            ],
          },
          email: "$expertInfo.email",
          specialization: "$expertInfo.specialization",
          profileImage: "$expertInfo.profileImage",
          expertRate: "$expertInfo.commissionRate",
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);

    // Add commission calculations — per-expert override beats global rate.
    const experts = earningsPerExpert.map((e) => {
      const effectiveRate = resolveExpertRate(e.expertRate, commissionRate);
      const commission = Math.round((e.totalAmount * effectiveRate) / 100);
      return {
        expertId: e.expertId,
        name: e.name.trim(),
        email: e.email,
        specialization: e.specialization,
        profileImage: e.profileImage,
        totalAmount: e.totalAmount,
        commissionRate: effectiveRate,
        adminCommission: commission,
        expertPayout: e.totalAmount - commission,
        sessionCount: e.sessionCount,
      };
    });

    const totalRevenue = experts.reduce((sum, e) => sum + e.totalAmount, 0);
    const totalCommission = experts.reduce(
      (sum, e) => sum + e.adminCommission,
      0,
    );

    res.status(200).json({
      success: true,
      data: {
        experts,
        summary: {
          totalRevenue,
          totalCommission,
          totalExpertPayouts: totalRevenue - totalCommission,
          commissionRate,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching expert earnings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch expert earnings",
    });
  }
});

// Update commission rate (superadmin only)
const updateCommissionRate = asyncHandler(async (req, res) => {
  try {
    const { commissionRate } = req.body;
    if (
      typeof commissionRate !== "number" ||
      commissionRate < 0 ||
      commissionRate > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Commission rate must be a number between 0 and 100",
      });
    }
    // Update all admins or just superadmin – update all so any admin returning stats gets same rate
    await Admin.updateMany({}, { commissionRate });
    res.status(200).json({
      success: true,
      message: `Commission rate updated to ${commissionRate}%`,
      data: { commissionRate },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update commission rate",
    });
  }
});

// Update a single expert's commission rate override.
// Pass `commissionRate: null` to clear the override and fall back to the global rate.
const updateExpertCommissionRate = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { commissionRate } = req.body;

    if (commissionRate !== null && commissionRate !== undefined) {
      if (
        typeof commissionRate !== "number" ||
        commissionRate < 0 ||
        commissionRate > 100
      ) {
        return res.status(400).json({
          success: false,
          message:
            "commissionRate must be a number between 0 and 100, or null to reset",
        });
      }
    }

    const update =
      commissionRate === null || commissionRate === undefined
        ? { $unset: { commissionRate: "" } }
        : { $set: { commissionRate } };

    const expert = await Expert.findByIdAndUpdate(id, update, {
      new: true,
    }).select("firstName lastName email commissionRate");

    if (!expert) {
      return res
        .status(404)
        .json({ success: false, message: "Expert not found" });
    }

    return res.status(200).json({
      success: true,
      message:
        commissionRate === null || commissionRate === undefined
          ? "Expert commission override cleared (using global default)"
          : `Expert commission rate set to ${commissionRate}%`,
      data: { expert },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update expert commission rate",
    });
  }
});

// Get all expert bank accounts with earnings summary (admin view)
const getExpertBankAccounts = asyncHandler(async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Get global commission rate
    const commissionRate = await getCommissionRate();

    // Build expert query for search
    const expertQuery: any = {};
    if (search) {
      expertQuery.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { specialization: { $regex: search, $options: "i" } },
      ];
    }

    const totalExperts = await Expert.countDocuments(expertQuery);
    const experts = await Expert.find(expertQuery)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const expertIds = experts.map((e) => e._id);

    // Fetch bank accounts for these experts
    const bankAccounts = await BankAccount.find({ expert: { $in: expertIds } });
    const bankMap: Record<string, any> = {};
    bankAccounts.forEach((b) => {
      bankMap[b.expert.toString()] = b;
    });

    // Fetch earnings per expert from completed payments
    const earningsRaw = await Payment.aggregate([
      { $match: { status: "completed", expert: { $in: expertIds } } },
      {
        $group: {
          _id: "$expert",
          totalAmount: { $sum: "$amount" },
          sessionCount: { $sum: 1 },
        },
      },
    ]);
    const earningsMap: Record<
      string,
      { totalAmount: number; sessionCount: number }
    > = {};
    earningsRaw.forEach((e) => {
      earningsMap[e._id.toString()] = e;
    });

    const result = experts.map((expert) => {
      const id = expert._id.toString();
      const bankAccount = bankMap[id] || null;
      const earnings = earningsMap[id] || { totalAmount: 0, sessionCount: 0 };
      const effectiveRate = resolveExpertRate(
        (expert as any).commissionRate,
        commissionRate,
      );
      const adminCommission = Math.round(
        (earnings.totalAmount * effectiveRate) / 100,
      );
      const expertPayout = earnings.totalAmount - adminCommission;

      return {
        id,
        firstName: expert.firstName,
        lastName: expert.lastName,
        email: expert.email,
        phone: expert.phone,
        specialization: expert.specialization,
        isActive: expert.isActive,
        verificationStatus: expert.verificationStatus,
        bankAccount: bankAccount
          ? {
              accountHolderName: bankAccount.accountHolderName,
              accountNumber: bankAccount.accountNumber,
              bankName: bankAccount.bankName,
              ifscCode: bankAccount.ifscCode,
              branchName: bankAccount.branchName || "",
              accountType: bankAccount.accountType,
              isActive: bankAccount.isActive,
            }
          : null,
        earnings: {
          totalAmount: earnings.totalAmount,
          sessionCount: earnings.sessionCount,
          commissionRate: effectiveRate,
          adminCommission,
          expertPayout,
        },
      };
    });

    res.status(200).json({
      success: true,
      data: {
        experts: result,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalExperts,
          pages: Math.ceil(totalExperts / limitNum),
        },
        summary: {
          totalExperts,
          expertsWithBank: bankAccounts.length,
          expertsWithoutBank: totalExperts - bankAccounts.length,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching expert bank accounts:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch expert bank accounts",
      });
  }
});

export {
  getExpertStats,
  getExperts,
  getExpertById,
  createExpert,
  updateExpert,
  deleteExpert,
  toggleExpertStatus,
  toggleExpertVerification,
  getExpertEarnings,
  updateCommissionRate,
  updateExpertCommissionRate,
  getExpertBankAccounts,
};
