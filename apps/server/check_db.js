const mongoose = require('mongoose');

async function check() {
  try {
    await mongoose.connect('mongodb://localhost:27017/wallet-chat');
    const msgCount = await mongoose.connection.db.collection('messages').countDocuments();
    const reqCount = await mongoose.connection.db.collection('chatrequests').countDocuments();
    const userCount = await mongoose.connection.db.collection('users').countDocuments();
    
    console.log('--- DATABASE STATUS ---');
    console.log('Users:', userCount);
    console.log('ChatRequests:', reqCount);
    console.log('Messages:', msgCount);
    
    if (msgCount > 0) {
      const msgs = await mongoose.connection.db.collection('messages').find().sort({createdAt: -1}).limit(2).toArray();
      console.log('Latest Messages:', JSON.stringify(msgs, null, 2));
    }
    
    const accepted = await mongoose.connection.db.collection('chatrequests').find({status: 'accepted'}).toArray();
    console.log('Accepted Requests:', JSON.stringify(accepted, null, 2));
    
    await mongoose.disconnect();
  } catch (err) {
    console.error('Check failed:', err);
  }
}

check();
