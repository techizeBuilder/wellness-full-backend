import { asyncHandler } from '../../middlewares/errorHandler';
import Payment from '../../models/Payment';
import User from '../../models/User';

// @desc    Get all payments (Admin)
// @route   GET /api/admin/payments
// @access  Private (Admin)
export const getAllPayments = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20, search, startDate, endDate, specialization } = req.query;
  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);
  const skip = (pageNum - 1) * limitNum;

  const query: any = {};
  
  // Status filter - map UI status to DB status
  if (status && status !== 'All') {
    const statusMap: { [key: string]: string } = {
      'Completed': 'completed',
      'Pending': 'pending',
      'Refunded': 'refunded',
      'Failed': 'failed',
      'Processing': 'processing',
      'Cancelled': 'cancelled'
    };
    query.status = statusMap[status] || status.toLowerCase();
  }

  // Date range filter
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) {
      query.createdAt.$gte = new Date(startDate as string);
    }
    if (endDate) {
      const end = new Date(endDate as string);
      end.setHours(23, 59, 59, 999); // Include the entire end date
      query.createdAt.$lte = end;
    }
  }

  // Specialization filter - we'll filter after populating expert
  let specializationFilter = null;
  if (specialization && specialization !== 'All') {
    specializationFilter = specialization as string;
  }

  // Build search query if provided
  let searchQuery: any = {};
  if (search) {
    // Search by user name, email, transaction ID, or payment ID
    const users = await User.find({
      $or: [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ]
    }).select('_id');
    
    const userIds = users.map(u => u._id);
    
    const searchConditions: any[] = [
      { razorpayOrderId: { $regex: search, $options: 'i' } },
      { razorpayPaymentId: { $regex: search, $options: 'i' } }
    ];
    
    if (userIds.length > 0) {
      searchConditions.push({ user: { $in: userIds } });
    }
    
    searchQuery = {
      $or: searchConditions
    };
  }

  const finalQuery = { ...query, ...searchQuery };

  // Get payments with populated data
  let payments = await Payment.find(finalQuery)
    .populate('user', 'firstName lastName email')
    .populate('expert', 'firstName lastName specialization')
    .populate('appointment', 'sessionDate startTime duration')
    .populate('subscription', 'planName')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum);

  // Filter by specialization if provided
  if (specializationFilter) {
    payments = payments.filter((payment: any) => 
      payment.expert && payment.expert.specialization && 
      payment.expert.specialization.toLowerCase() === specializationFilter.toLowerCase()
    );
  }

  const total = await Payment.countDocuments(finalQuery);

  // Get stats
  const totalRevenue = await Payment.aggregate([
    { $match: { status: 'completed' } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);
  
  const pendingAmount = await Payment.aggregate([
    { $match: { status: 'pending' } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);
  
  const refundedAmount = await Payment.aggregate([
    { $match: { status: 'refunded' } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);

  const totalTransactions = await Payment.countDocuments();

  res.status(200).json({
    success: true,
    data: {
      payments,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      },
      stats: {
        totalRevenue: totalRevenue[0]?.total || 0,
        pendingAmount: pendingAmount[0]?.total || 0,
        refundedAmount: refundedAmount[0]?.total || 0,
        totalTransactions
      }
    }
  });
});

// @desc    Get payment by ID (Admin)
// @route   GET /api/admin/payments/:id
// @access  Private (Admin)
export const getPaymentById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const payment = await Payment.findById(id)
    .populate('user', 'firstName lastName email phone')
    .populate('expert', 'firstName lastName specialization email')
    .populate('appointment', 'sessionDate startTime duration consultationMethod')
    .populate('subscription', 'planName')
    .populate('plan', 'name price');

  if (!payment) {
    return res.status(404).json({
      success: false,
      message: 'Payment not found'
    });
  }

  res.status(200).json({
    success: true,
    data: { payment }
  });
});

// @desc    Update payment status (Admin)
// @route   PATCH /api/admin/payments/:id/status
// @access  Private (Admin)
export const updatePaymentStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled'];
  
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Valid status is required. Must be one of: ${validStatuses.join(', ')}`
    });
  }

  const payment = await Payment.findById(id);

  if (!payment) {
    return res.status(404).json({
      success: false,
      message: 'Payment not found'
    });
  }

  // Update status and relevant timestamps
  payment.status = status as any;
  
  if (status === 'completed' && !payment.paidAt) {
    payment.paidAt = new Date();
  } else if (status === 'failed' && !payment.failedAt) {
    payment.failedAt = new Date();
  } else if (status === 'refunded' && !payment.refundedAt) {
    payment.refundedAt = new Date();
  }

  await payment.save();

  res.status(200).json({
    success: true,
    data: { payment },
    message: 'Payment status updated successfully'
  });
});

