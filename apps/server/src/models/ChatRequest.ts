import mongoose from 'mongoose';
import { UserDocument } from './User'; // Import UserDocument

export interface ChatRequestDocument extends mongoose.Document {
  from: mongoose.Types.ObjectId | UserDocument;
  to: mongoose.Types.ObjectId | UserDocument;
  fromWallet: string;
  toWallet: string;
  status: 'pending' | 'accepted' | 'rejected';
  fromCustomName?: string;
  toCustomName?: string;
  hiddenBy: mongoose.Types.ObjectId[];
}

const chatRequestSchema = new mongoose.Schema<ChatRequestDocument>({
  from: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  to: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  fromWallet: {
    type: String,
    required: true,
  },
  toWallet: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending',
  },
  fromCustomName: {
    type: String,
  },
  toCustomName: {
    type: String,
  },
  hiddenBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
}, { timestamps: true });

// Prevent duplicate requests between the same two wallets (direction matters for 'pending')
// We can also add a logic to prevent reverse requests if one is already pending/accepted
chatRequestSchema.index({ fromWallet: 1, toWallet: 1 }, { unique: true });
chatRequestSchema.index({ fromWallet: 1 });
chatRequestSchema.index({ toWallet: 1 });
chatRequestSchema.index({ status: 1 });

export const ChatRequest = mongoose.model<ChatRequestDocument>('ChatRequest', chatRequestSchema);
