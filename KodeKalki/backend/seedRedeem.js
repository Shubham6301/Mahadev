import './loadenv.js';
import mongoose from 'mongoose';
import { RedeemItem } from './models/Redeem.js';

const seedData = [
  {
    _id: new mongoose.Types.ObjectId("694196b14698b6182a86cb8e"),
    name: "Coding T-Shirt",
    description: "Premium quality cotton t-shirt with coding quotes and programming humor",
    coinsCost: 652,
    category: "clothing",
    imageUrl: "https://res.cloudinary.com/dwh8yiung/image/upload/v1765908013/tshirt_dm8py0.png",
    inStock: true,
    popularity: 95,
  },
  {
    _id: new mongoose.Types.ObjectId("694196b14698b6182a86cb8f"),
    name: "Programming Mug",
    description: "Coffee mug for programmers with funny coding jokes",
    coinsCost: 350,
    category: "accessories",
    imageUrl: "https://res.cloudinary.com/dwh8yiung/image/upload/v1765908394/Gemini_Generated_Image_z81p4ez81p4ez81p_hzp6ve.png",
    inStock: true,
    popularity: 88,
  },
  {
    _id: new mongoose.Types.ObjectId("694196b14698b6182a86cb90"),
    name: "Bluetooth Headphones",
    description: "Wireless headphones perfect for coding sessions",
    coinsCost: 1200,
    category: "electronics",
    imageUrl: "https://res.cloudinary.com/dwh8yiung/image/upload/v1765908269/Gemini_Generated_Image_ydws23ydws23ydws_wjaqhw.png",
    inStock: true,
    popularity: 92,
  },
  {
    _id: new mongoose.Types.ObjectId("694196b14698b6182a86cb91"),
    name: "Algorithm Book",
    description: "Advanced algorithms and data structures book",
    coinsCost: 250,
    category: "books",
    imageUrl: "https://res.cloudinary.com/dwh8yiung/image/upload/v1765902008/Gemini_Generated_Image_j7xx1qj7xx1qj7xx_jc9zts.png",
    inStock: true,
    popularity: 85,
  },
  {
    _id: new mongoose.Types.ObjectId("694196b14698b6182a86cb92"),
    name: "Amazon Gift Card ($52)",
    description: "$25 Amazon gift card for your shopping needs - Digital delivery",
    coinsCost: 2000,
    category: "vouchers",
    imageUrl: "https://res.cloudinary.com/dwh8yiung/image/upload/v1765902009/Gemini_Generated_Image_wpyxc6wpyxc6wpyx_upovv2.png",
    inStock: true,
    popularity: 98,
  },
  {
    _id: new mongoose.Types.ObjectId("694196b14698b6182a86cb93"),
    name: "Mechanical Keyboard",
    description: "RGB mechanical keyboard for better coding experience",
    coinsCost: 1500,
    category: "electronics",
    imageUrl: "https://res.cloudinary.com/dwh8yiung/image/upload/v1765908614/Gemini_Generated_Image_kokhiskokhiskokh_nnblhk.png",
    inStock: false,
    popularity: 90,
  },
  {
    _id: new mongoose.Types.ObjectId("694196b14698b6182a86cb94"),
    name: "Coding Hoodie",
    description: "Comfortable hoodie with developer-themed designs",
    coinsCost: 1500,
    category: "clothing",
    imageUrl: "https://res.cloudinary.com/dwh8yiung/image/upload/v1765908718/Gemini_Generated_Image_6z7u3j6z7u3j6z7u_lwfx5c.png",
    inStock: true,
    popularity: 87,
  },
  {
    _id: new mongoose.Types.ObjectId("694196b14698b6182a86cb95"),
    name: "Mouse Pad",
    description: "Large gaming mouse pad with programming motifs",
    coinsCost: 200,
    category: "accessories",
    imageUrl: "https://res.cloudinary.com/dwh8yiung/image/upload/v1765908874/Gemini_Generated_Image_v7rhulv7rhulv7rh_vbgsk1.png",
    inStock: true,
    popularity: 75,
  },
  {
    _id: new mongoose.Types.ObjectId("6941a1c378e05d80e779d70d"),
    name: "WaterBottle",
    description: "Durable water bottle ideal for daily use during coding sessions",
    coinsCost: 1100,
    category: "accessories",
    imageUrl: "https://res.cloudinary.com/dwh8yiung/image/upload/v1765902008/Gemini_Generated_Image_ltxvnltxvnltxvnl_sp4qsm.png",
    inStock: true,
    popularity: 88,
  },
  {
    _id: new mongoose.Types.ObjectId("6941a1c378e05d80e779d70e"),
    name: "CAP",
    description: "Stylish cap with developer-themed design",
    coinsCost: 350,
    category: "clothing",
    imageUrl: "https://res.cloudinary.com/dwh8yiung/image/upload/v1765902010/Gemini_Generated_Image_jmwxl9jmwxl9jmwx_lyuozf.png",
    inStock: true,
    popularity: 90,
  },
];

async function seedRedeemItems() {
  try {
    console.log('🌱 Connecting to MongoDB...');
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/KodeKalki"
    );
    console.log('✅ Connected to MongoDB');

    console.log('🗑️ Clearing existing redeem items...');
    await RedeemItem.deleteMany({});

    console.log('🌱 Seeding redeem items...');
    await RedeemItem.insertMany(seedData);

    console.log(`✅ Successfully seeded ${seedData.length} redeem items!`);
    
    // Display seeded items
    console.log('\n📦 Seeded Items:');
    seedData.forEach((item, index) => {
      console.log(`${index + 1}. ${item.name} - ${item.coinsCost} coins (${item.category})`);
    });

  } catch (error) {
    console.error('❌ Error seeding redeem items:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

seedRedeemItems();
