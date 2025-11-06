const VERIFICATION_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  SUSPENDED: 'suspended'
};

const VERIFICATION_STATUS_ENUM = Object.values(VERIFICATION_STATUS);

module.exports = {
  VERIFICATION_STATUS,
  VERIFICATION_STATUS_ENUM
};

