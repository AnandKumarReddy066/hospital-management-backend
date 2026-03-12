const mongoose = require('mongoose');
const User = require('./models/User');

const MONGO_URI = 'mongodb://localhost:27017/hsptl_db';

const createMocks = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const usersToCreate = [
      {
        firstName: 'System',
        lastName: 'Admin',
        email: 'admin@hsptl.com',
        phone: '1234567891',
        password: 'password123',
        role: 'admin',
        isEmailVerified: true,
        isPhoneVerified: true
      },
      {
        firstName: 'John',
        lastName: 'Doctor',
        email: 'doctor@hsptl.com',
        phone: '1234567892',
        password: 'password123',
        role: 'doctor',
        isEmailVerified: true,
        isPhoneVerified: true
      },
      {
        firstName: 'Jane',
        lastName: 'Staff',
        email: 'staff@hsptl.com',
        phone: '1234567893',
        password: 'password123',
        role: 'staff',
        isEmailVerified: true,
        isPhoneVerified: true
      }
    ];

    for (const userData of usersToCreate) {
      const existingUser = await User.findOne({ email: userData.email });
      if (!existingUser) {
        const user = new User(userData);
        await user.save();
        console.log(`Created mock user: ${userData.email} with password password123`);
      } else {
        console.log(`Mock user already exists: ${userData.email}`);
      }
    }

    console.log('Mock credentials creation successful.');
  } catch (error) {
    console.error('Error creating mock users:', error);
  } finally {
    await mongoose.disconnect();
  }
};

createMocks();
