import express from "express";
import { authenticateToken as auth } from "../middleware/auth.js";
import { RedeemItem, RedeemOrder } from "../models/Redeem.js";
import User from "../models/User.js";
import { notify, notifyAdmin } from "../utils/notificationHelper.js"; // 🔔 ADD

const router = express.Router();

// Get all redeem items
router.get('/items', async (req, res) => {
  try {
    const items = await RedeemItem.find({}).sort({ popularity: -1 });
    res.json({ items });
  } catch (error) {
    console.error('Error fetching redeem items:', error);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// Get redeem items by category
router.get("/items/:category", auth, async (req, res) => {
  try {
    const { category } = req.params;
    const items = await RedeemItem.find({ category }).sort({
      popularity: -1,
      createdAt: -1,
    });
    res.json({ items });
  } catch (error) {
    console.error("Error fetching redeem items by category:", error);
    res.status(500).json({ error: "Failed to fetch redeem items" });
  }
});

// Cancel order (user)
router.post("/cancel-order", auth, async (req, res) => {
  try {
    const { orderId, reason } = req.body;
    const userId = req.user.id;

    if (!orderId) {
      return res.status(400).json({ error: "Order ID is required" });
    }

    const order = await RedeemOrder.findOne({ _id: orderId, userId })
      .populate("itemId", "name");

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (!["pending", "processing"].includes(order.status)) {
      return res.status(400).json({
        error: "Order cannot be cancelled at this stage",
      });
    }

    // Update order fields
    order.status = "cancelled";
    order.cancelledBy = "user";
    order.cancelReason = reason || "No reason provided";
    order.cancelledAt = new Date();
    order.deliveredAt = null;

    await order.save();

    // Refund coins
    const user = await User.findById(userId);
    user.coins = (user.coins || 0) + order.totalCost;
    await user.save();

    const itemName = order.itemId?.name || "your item";

    // 🔔 Notify user — cancelled by themselves + coins refunded
    await notify(
      userId,
      'order_update',
      '❌ Order Cancelled',
      `Your order for "${itemName}" has been cancelled. ${order.totalCost} coins refunded to your account.`,
      '/redeem',
      { orderId: order._id, status: 'cancelled', refundedCoins: order.totalCost }
    );

    // 🔔 Notify admin — user cancelled an order
    await notifyAdmin(
      'admin_order_status_change',
      '❌ Order Cancelled by User',
      `${user.username} cancelled order for "${itemName}". Reason: ${order.cancelReason}`,
      '/admin',
      { orderId: order._id, userId, reason: order.cancelReason }
    );

    res.json({
      message: "Order cancelled successfully",
      refundedCoins: order.totalCost,
      currentCoins: user.coins,
    });
  } catch (error) {
    console.error("Error cancelling order:", error);
    res.status(500).json({ error: "Failed to cancel order" });
  }
});

// Create a new redeem order
router.post("/order", auth, async (req, res) => {
  try {
    const { itemId, quantity = 1, deliveryAddress } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!itemId || !deliveryAddress) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Check if item exists and is in stock
    const item = await RedeemItem.findById(itemId);
    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }

    if (!item.inStock) {
      return res.status(400).json({ error: "Item is out of stock" });
    }

    // Calculate total cost
    const totalCost = item.coinsCost * quantity;

    // Get user and check if they have enough coins
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if ((user.coins || 0) < totalCost) {
      return res.status(400).json({
        error: `Insufficient coins. You need ${totalCost} coins but have ${
          user.coins || 0
        } coins.`,
      });
    }

    // Validate delivery address fields
    const requiredFields = [
      "fullName",
      "phone",
      "address",
      "city",
      "state",
      "pincode",
    ];
    for (const field of requiredFields) {
      if (!deliveryAddress[field] || deliveryAddress[field].trim() === "") {
        return res.status(400).json({
          error: `Missing or empty field: ${field}`,
        });
      }
    }

    // Create the order
    const order = new RedeemOrder({
      userId,
      itemId,
      quantity,
      totalCost,
      deliveryAddress: {
        fullName: deliveryAddress.fullName.trim(),
        phone: deliveryAddress.phone.trim(),
        address: deliveryAddress.address.trim(),
        city: deliveryAddress.city.trim(),
        state: deliveryAddress.state.trim(),
        pincode: deliveryAddress.pincode.trim(),
      },
    });

    // Save the order
    await order.save();

    // Deduct coins from user
    user.coins = (user.coins || 0) - totalCost;
    await user.save();

    // Populate the order with item details for response
    await order.populate("itemId", "name description imageUrl");

    // 🔔 Notify user — order placed successfully
    await notify(
      userId,
      'order_update',
      '🛒 Order Placed!',
      `Your order for "${item.name}" (${quantity}x) has been placed for ${totalCost} coins. We'll process it soon!`,
      '/redeem',
      { orderId: order._id, status: 'pending', totalCost }
    );

    // 🔔 Notify admin — new order received
    await notifyAdmin(
      'admin_new_order',
      '🛒 New Order Received',
      `${user.username} ordered "${item.name}" (${quantity}x) — ${totalCost} coins`,
      '/admin',
      { orderId: order._id, userId, itemId, quantity, totalCost }
    );

    res.status(201).json({
      message: "Order placed successfully",
      order,
      remainingCoins: user.coins,
    });
  } catch (error) {
    console.error("Error creating redeem order:", error);
    res.status(500).json({ error: "Failed to process order" });
  }
});

// Get user's redeem orders
router.get("/orders", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const orders = await RedeemOrder.find({ userId })
      .populate("itemId", "name description imageUrl coinsCost")
      .sort({ orderDate: -1 });

    res.json({ orders });
  } catch (error) {
    console.error("Error fetching user orders:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// Get specific order details
router.get("/orders/:orderId", auth, async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    const order = await RedeemOrder.findOne({ _id: orderId, userId }).populate(
      "itemId",
      "name description imageUrl coinsCost"
    );

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json({ order });
  } catch (error) {
    console.error("Error fetching order details:", error);
    res.status(500).json({ error: "Failed to fetch order details" });
  }
});

// Admin: Add new redeem item
router.post("/admin/items", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const {
      name,
      description,
      coinsCost,
      category,
      imageUrl,
      inStock = true,
      popularity = 0,
    } = req.body;

    if (!name || !description || !coinsCost || !category || !imageUrl) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const item = new RedeemItem({
      name,
      description,
      coinsCost,
      category,
      imageUrl,
      inStock,
      popularity,
    });

    await item.save();
    res.status(201).json({ message: "Item added successfully", item });
  } catch (error) {
    console.error("Error adding redeem item:", error);
    res.status(500).json({ error: "Failed to add item" });
  }
});

// Admin: Update redeem item
router.put("/admin/items/:itemId", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { itemId } = req.params;
    const updates = req.body;

    const item = await RedeemItem.findByIdAndUpdate(itemId, updates, {
      new: true,
      runValidators: true,
    });

    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }

    res.json({ message: "Item updated successfully", item });
  } catch (error) {
    console.error("Error updating redeem item:", error);
    res.status(500).json({ error: "Failed to update item" });
  }
});

// Admin: Get all orders
router.get("/admin/orders", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const orders = await RedeemOrder.find()
      .populate("userId", "username email profile")
      .populate("itemId", "name description imageUrl coinsCost")
      .sort({ orderDate: -1 });

    res.json({ orders });
  } catch (error) {
    console.error("Error fetching all orders:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// Admin: Update order status (enhanced with delivery predictions)
router.put("/admin/orders/:orderId", auth, async (req, res) => {
  try {
    const admin = await User.findById(req.user.id);
    if (!admin || admin.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { orderId } = req.params;
    const { status, trackingNumber, reason, deliveredAt, predictedDeliveryDate } = req.body;

    const order = await RedeemOrder.findById(orderId)
      .populate("userId", "username _id")
      .populate("itemId", "name");

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Prevent changes if already cancelled
    if (order.status === "cancelled") {
      return res.status(400).json({ error: "Order already cancelled" });
    }

    // Delivered orders cannot be cancelled
    if (order.status === "delivered" && status === "cancelled") {
      return res.status(400).json({
        error: "Delivered orders cannot be cancelled",
      });
    }

    const itemName  = order.itemId?.name     || "your item";
    const orderUserId   = order.userId?._id;
    const orderUsername = order.userId?.username || "User";

    // --- Admin cancelling ---
    if (status === "cancelled") {
      if (!reason || reason.trim() === "") {
        return res.status(400).json({ error: "Cancellation reason is required" });
      }

      order.status = "cancelled";
      order.cancelledBy = "admin";
      order.cancelReason = reason.trim();
      order.cancelledAt = new Date();
      order.deliveredAt = null;
      order.predictedDeliveryDate = null;

      // Refund coins to user
      const user = await User.findById(order.userId);
      if (user) {
        user.coins = (user.coins || 0) + order.totalCost;
        await user.save();
      }

      // 🔔 Notify user — admin cancelled + coins refunded
      if (orderUserId) {
        await notify(
          orderUserId,
          'order_update',
          '❌ Order Cancelled by Admin',
          `Your order for "${itemName}" was cancelled by admin. Reason: ${reason.trim()}. ${order.totalCost} coins have been refunded.`,
          '/redeem',
          { orderId: order._id, status: 'cancelled', refundedCoins: order.totalCost }
        );
      }

    } else {
      // Non-cancellation status updates
      order.status = status;

      if (status === "delivered") {
        order.deliveredAt = deliveredAt ? new Date(deliveredAt) : new Date();
        order.predictedDeliveryDate = null;
      } else if (status === "shipped") {
        if (predictedDeliveryDate) {
          order.predictedDeliveryDate = new Date(predictedDeliveryDate);
        } else if (!order.predictedDeliveryDate) {
          const predicted = new Date();
          predicted.setDate(predicted.getDate() + 7); // 7 days estimate
          order.predictedDeliveryDate = predicted;
        }
        order.deliveredAt = null;
      } else {
        order.deliveredAt = null;
        if (status === "processing" && predictedDeliveryDate) {
          order.predictedDeliveryDate = new Date(predictedDeliveryDate);
        }
      }

      // 🔔 Notify user per status
      const statusMessages = {
        pending: {
          title: '🕐 Order Pending',
          msg: `Your order for "${itemName}" is pending.`,
        },
        processing: {
          title: '⚙️ Order Processing',
          msg: `Your order for "${itemName}" is being processed!`,
        },
        confirmed: {
          title: '✅ Order Confirmed',
          msg: `Your order for "${itemName}" has been confirmed!`,
        },
        shipped: {
          title: '🚚 Order Shipped!',
          msg: `Your order for "${itemName}" is on the way${trackingNumber ? ` — Tracking: ${trackingNumber}` : ''}!`,
        },
        delivered: {
          title: '🎉 Order Delivered!',
          msg: `Your order for "${itemName}" has been delivered. Enjoy!`,
        },
      };

      const notifData = statusMessages[status];
      if (notifData && orderUserId) {
        await notify(
          orderUserId,
          'order_update',
          notifData.title,
          notifData.msg,
          '/redeem',
          { orderId: order._id, status, trackingNumber }
        );
      }
    }

    if (trackingNumber) {
      order.trackingNumber = trackingNumber;
    }

    await order.save();

    // 🔔 Notify admin panel log — status changed
    await notifyAdmin(
      'admin_order_status_change',
      `📦 Order → ${status.toUpperCase()}`,
      `${orderUsername}'s order for "${itemName}" marked as ${status}`,
      '/admin',
      { orderId: order._id, status, trackingNumber }
    );

    res.json({ message: "Order updated successfully", order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
