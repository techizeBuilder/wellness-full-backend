import mongoose, { Document, Model } from 'mongoose';

export interface IBankAccount extends Document {
  expert: mongoose.Types.ObjectId;
  accountHolderName: string;
  accountNumber: string;
  bankName: string;
  ifscCode: string;
  branchName?: string;
  accountType: 'savings' | 'current';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

type BankAccountModel = Model<IBankAccount>;

const bankAccountSchema = new mongoose.Schema<IBankAccount, BankAccountModel>(
  {
    expert: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Expert',
      required: [true, 'Expert reference is required'],
      unique: true, // Ensure only one bank account per expert
      index: true
    },
    accountHolderName: {
      type: String,
      required: [true, 'Account holder name is required'],
      trim: true,
      maxlength: [100, 'Account holder name cannot exceed 100 characters']
    },
    accountNumber: {
      type: String,
      required: [true, 'Account number is required'],
      trim: true,
      match: [/^\d{9,18}$/, 'Please enter a valid account number (9-18 digits)']
    },
    bankName: {
      type: String,
      required: [true, 'Bank name is required'],
      trim: true,
      maxlength: [100, 'Bank name cannot exceed 100 characters']
    },
    ifscCode: {
      type: String,
      required: [true, 'IFSC code is required'],
      trim: true,
      uppercase: true,
      match: [/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Please enter a valid IFSC code']
    },
    branchName: {
      type: String,
      trim: true,
      maxlength: [100, 'Branch name cannot exceed 100 characters']
    },
    accountType: {
      type: String,
      enum: ['savings', 'current'],
      required: [true, 'Account type is required'],
      default: 'savings'
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// Index for faster queries
bankAccountSchema.index({ expert: 1 });

const BankAccount = mongoose.model<IBankAccount, BankAccountModel>('BankAccount', bankAccountSchema);

export default BankAccount;

