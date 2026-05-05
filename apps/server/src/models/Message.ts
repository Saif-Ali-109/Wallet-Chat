import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  roomId: {
    type: String,
    required: true,
    index: true,
  },
  encryptedContent: {
    type: String,
    required: true,
  },
  encryptedContentForSender: {
    type: String,
    required: false,
    default: null,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  read: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

export const Message = mongoose.model('Message', messageSchema);
