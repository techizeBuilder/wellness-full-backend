import { asyncHandler } from '../../middlewares/errorHandler';
import User from '../../models/User';
import Expert from '../../models/Expert';
import Appointment from '../../models/Appointment';
import Payment from '../../models/Payment';

// Helper function to get date range based on filter
const getDateRange = (dateRange: string) => {
  const now = new Date();
  let startDate: Date;
  
  switch (dateRange) {
    case 'last7days':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'last30days':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case 'last90days':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case 'last365days':
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
  
  return { startDate, endDate: now };
};

// @desc    Get reports and analytics data
// @route   GET /api/admin/reports
// @access  Private (Admin)
export const getReports = asyncHandler(async (req, res) => {
  try {
    const { dateRange = 'last30days' } = req.query;
    const { startDate, endDate } = getDateRange(dateRange as string);

    // Get basic stats
    const totalUsers = await User.countDocuments({ userType: 'user' });
    const activeBookings = await Appointment.countDocuments({ 
      status: { $in: ['pending', 'confirmed'] } 
    });

    // Get revenue stats for the date range
    const revenueStats = await Payment.aggregate([
      {
        $match: { 
          status: 'completed',
          createdAt: {
            $gte: startDate,
            $lte: endDate
          }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);
    const monthlyRevenue = revenueStats[0]?.total || 0;

    // Get revenue data (monthly breakdown within date range)
    const revenueData = await Payment.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: {
            $gte: startDate,
            $lte: endDate
          }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          revenue: { $sum: '$amount' },
          bookings: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    // Get user growth data
    const userGrowthData = await User.aggregate([
      {
        $match: {
          userType: 'user',
          createdAt: {
            $gte: startDate,
            $lte: endDate
          }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    // Get monthly active users and sessions
    const monthlyActiveUsers = await Appointment.aggregate([
      {
        $match: {
          createdAt: {
            $gte: startDate,
            $lte: endDate
          }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          sessions: { $sum: 1 },
          uniqueUsers: { $addToSet: '$user' }
        }
      },
      {
        $project: {
          _id: 1,
          sessions: 1,
          users: { $size: '$uniqueUsers' }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    // Get category/specialization distribution
    const categoryData = await Appointment.aggregate([
      {
        $match: {
          createdAt: {
            $gte: startDate,
            $lte: endDate
          }
        }
      },
      {
        $lookup: {
          from: 'experts',
          localField: 'expert',
          foreignField: '_id',
          as: 'expertDetails'
        }
      },
      {
        $unwind: '$expertDetails'
      },
      {
        $group: {
          _id: '$expertDetails.specialization',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 5
      }
    ]);

    // Get top performing experts
    const expertPerformanceData = await Appointment.aggregate([
      {
        $match: {
          status: { $in: ['completed', 'confirmed'] },
          createdAt: {
            $gte: startDate,
            $lte: endDate
          }
        }
      },
      {
        $group: {
          _id: '$expert',
          sessions: { $sum: 1 },
          revenue: { $sum: '$price' }
        }
      },
      {
        $sort: { sessions: -1 }
      },
      {
        $limit: 5
      },
      {
        $lookup: {
          from: 'experts',
          localField: '_id',
          foreignField: '_id',
          as: 'expertDetails'
        }
      },
      {
        $unwind: '$expertDetails'
      },
      {
        $project: {
          name: {
            $concat: [
              { $ifNull: ['$expertDetails.firstName', ''] },
              ' ',
              { $ifNull: ['$expertDetails.lastName', ''] }
            ]
          },
          sessions: 1,
          revenue: 1,
          rating: { $ifNull: ['$expertDetails.averageRating', 0] }
        }
      }
    ]);

    // Get booking success rate
    const totalBookings = await Appointment.countDocuments({
      createdAt: {
        $gte: startDate,
        $lte: endDate
      }
    });
    const successfulBookings = await Appointment.countDocuments({
      status: 'completed',
      createdAt: {
        $gte: startDate,
        $lte: endDate
      }
    });
    const cancelledBookings = await Appointment.countDocuments({
      status: 'cancelled',
      createdAt: {
        $gte: startDate,
        $lte: endDate
      }
    });
    const noShowBookings = await Appointment.countDocuments({
      status: 'no-show',
      createdAt: {
        $gte: startDate,
        $lte: endDate
      }
    });

    const bookingSuccessRate = totalBookings > 0 
      ? ((successfulBookings / totalBookings) * 100).toFixed(1) 
      : '0.0';

    // Get customer satisfaction
    const satisfactionData = await Appointment.aggregate([
      {
        $match: {
          feedbackRating: { $exists: true, $ne: null },
          createdAt: {
            $gte: startDate,
            $lte: endDate
          }
        }
      },
      {
        $group: {
          _id: '$feedbackRating',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: -1 }
      }
    ]);

    // Calculate average rating
    const avgRatingData = await Appointment.aggregate([
      {
        $match: {
          feedbackRating: { $exists: true, $ne: null },
          createdAt: {
            $gte: startDate,
            $lte: endDate
          }
        }
      },
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$feedbackRating' },
          count: { $sum: 1 }
        }
      }
    ]);
    const avgRating = avgRatingData[0]?.avgRating || 0;

    // Format month names
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Format revenue data
    const formattedRevenue = revenueData.map(item => ({
      name: monthNames[item._id.month - 1],
      revenue: item.revenue,
      bookings: item.bookings
    }));

    // Format user growth data (cumulative)
    // First, get total users before the date range
    const usersBeforeRange = await User.countDocuments({
      userType: 'user',
      createdAt: { $lt: startDate }
    });
    
    let cumulativeUsers = usersBeforeRange;
    const userGrowthMap = new Map();
    userGrowthData.forEach(item => {
      const key = `${item._id.year}-${item._id.month}`;
      userGrowthMap.set(key, item.count);
    });

    const formattedUserGrowth = [];
    const sortedKeys = Array.from(userGrowthMap.keys()).sort();
    sortedKeys.forEach(key => {
      const count = userGrowthMap.get(key);
      cumulativeUsers += count;
      const [year, month] = key.split('-').map(Number);
      formattedUserGrowth.push({
        name: monthNames[month - 1],
        users: cumulativeUsers
      });
    });
    
    // If no data in range, show at least the baseline
    if (formattedUserGrowth.length === 0) {
      formattedUserGrowth.push({
        name: monthNames[startDate.getMonth()],
        users: usersBeforeRange
      });
    }

    // Format monthly active users
    const formattedMonthlyActive = monthlyActiveUsers.map(item => ({
      name: monthNames[item._id.month - 1],
      users: item.users,
      sessions: item.sessions
    }));

    // Format category data
    const totalAppointments = await Appointment.countDocuments({
      createdAt: {
        $gte: startDate,
        $lte: endDate
      }
    });
    const colors = ['#004d4d', '#ffd700', '#ff6f61', '#00b3b3', '#10b981'];
    const formattedCategories = categoryData.map((item, index) => ({
      name: item._id || 'Other',
      value: totalAppointments > 0 
        ? Math.round((item.count / totalAppointments) * 100) 
        : 0,
      color: colors[index % colors.length]
    }));

    // Format expert performance
    const formattedExpertPerformance = expertPerformanceData.map(expert => ({
      name: expert.name.trim() || 'Unknown Expert',
      sessions: expert.sessions,
      revenue: expert.revenue,
      rating: expert.rating || 0
    }));

    // Format satisfaction distribution
    const satisfactionMap = new Map();
    satisfactionData.forEach(item => {
      satisfactionMap.set(item._id, item.count);
    });
    const totalRatings = satisfactionData.reduce((sum, item) => sum + item.count, 0);
    
    const satisfactionDistribution = [5, 4, 3, 2, 1].map(rating => {
      const count = satisfactionMap.get(rating) || 0;
      const percentage = totalRatings > 0 ? ((count / totalRatings) * 100).toFixed(0) : '0';
      return {
        rating,
        count,
        percentage: `${percentage}%`
      };
    });

    // Calculate conversion rate
    const totalCompleted = await Appointment.countDocuments({
      status: 'completed',
      createdAt: {
        $gte: startDate,
        $lte: endDate
      }
    });
    const conversionRate = totalBookings > 0 
      ? ((totalCompleted / totalBookings) * 100).toFixed(1) 
      : '0.0';

    // Get growth percentages (comparing current period to previous period)
    const periodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const previousStartDate = new Date(startDate.getTime() - periodDays * 24 * 60 * 60 * 1000);
    const previousEndDate = startDate;

    const currentUsers = await User.countDocuments({
      userType: 'user',
      createdAt: {
        $gte: startDate,
        $lte: endDate
      }
    });
    const previousUsers = await User.countDocuments({
      userType: 'user',
      createdAt: {
        $gte: previousStartDate,
        $lte: previousEndDate
      }
    });
    const userGrowthPercent = previousUsers > 0 
      ? Math.round(((currentUsers - previousUsers) / previousUsers) * 100) 
      : 0;

    const currentBookings = await Appointment.countDocuments({
      createdAt: {
        $gte: startDate,
        $lte: endDate
      }
    });
    const previousBookings = await Appointment.countDocuments({
      createdAt: {
        $gte: previousStartDate,
        $lte: previousEndDate
      }
    });
    const bookingGrowthPercent = previousBookings > 0 
      ? Math.round(((currentBookings - previousBookings) / previousBookings) * 100) 
      : 0;

    const currentRevenue = await Payment.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: {
            $gte: startDate,
            $lte: endDate
          }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);
    const previousRevenue = await Payment.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: {
            $gte: previousStartDate,
            $lte: previousEndDate
          }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);
    const currentRev = currentRevenue[0]?.total || 0;
    const previousRev = previousRevenue[0]?.total || 0;
    const revenueGrowthPercent = previousRev > 0 
      ? Math.round(((currentRev - previousRev) / previousRev) * 100) 
      : 0;

    res.status(200).json({
      success: true,
      data: {
        stats: {
          totalUsers,
          activeBookings,
          monthlyRevenue,
          conversionRate
        },
        growth: {
          users: userGrowthPercent,
          bookings: bookingGrowthPercent,
          revenue: revenueGrowthPercent
        },
        revenueData: formattedRevenue,
        userGrowthData: formattedUserGrowth,
        categoryData: formattedCategories,
        monthlyActiveUsers: formattedMonthlyActive,
        expertPerformance: formattedExpertPerformance,
        bookingStats: {
          successRate: bookingSuccessRate,
          successful: successfulBookings,
          cancelled: cancelledBookings,
          noShows: noShowBookings
        },
        satisfaction: {
          average: avgRating.toFixed(1),
          distribution: satisfactionDistribution
        },
        platformGrowth: {
          newUsers: currentUsers,
          revenueGrowth: revenueGrowthPercent
        }
      }
    });
  } catch (error: any) {
    console.error('Error fetching reports:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reports data',
      error: error.message
    });
  }
});

