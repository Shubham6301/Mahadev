import express from "express";
import { authenticateToken as auth } from "../middleware/auth.js";
import { RedeemItem, RedeemOrder } from "../models/Redeem.js";
import User from "../models/User.js";

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

    const order = await RedeemOrder.findOne({ _id: orderId, userId });

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
    order.deliveredAt = null; // ensure delivered date is cleared

    await order.save();

    // Refund coins
    const user = await User.findById(userId);
    user.coins = (user.coins || 0) + order.totalCost;
    await user.save();

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
    // Check if user is admin
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
    // Check if user is admin
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
    // Check if user is admin
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

    const order = await RedeemOrder.findById(orderId);
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

    // --- Admin cancelling ---
    if (status === "cancelled") {
      if (!reason || reason.trim() === "") {
        return res.status(400).json({
          error: "Cancellation reason is required",
        });
      }

      order.status = "cancelled";
      order.cancelledBy = "admin";
      order.cancelReason = reason.trim();
      order.cancelledAt = new Date();
      order.deliveredAt = null;
      order.predictedDeliveryDate = null; // Clear prediction

      const user = await User.findById(order.userId);
      if (user) {
        user.coins = (user.coins || 0) + order.totalCost;
        await user.save();
      }
    } else {
      // Non‑cancellation update
      order.status = status;

      // Handle deliveredAt
      if (status === "delivered") {
        if (deliveredAt) {
          order.deliveredAt = new Date(deliveredAt);
        } else {
          order.deliveredAt = new Date();
        }
        // Clear prediction once delivered
        order.predictedDeliveryDate = null;
      } else if (status === "shipped") {
        // Auto-calculate predicted delivery (7 days from now if not provided)
        if (predictedDeliveryDate) {
          order.predictedDeliveryDate = new Date(predictedDeliveryDate);
        } else if (!order.predictedDeliveryDate) {
          const predicted = new Date();
          predicted.setDate(predicted.getDate() + 7); // 7 days delivery estimate
          order.predictedDeliveryDate = predicted;
        }
        order.deliveredAt = null;
      } else {
        // Status changed away from delivered/shipped
        order.deliveredAt = null;
        // Keep prediction for processing status
        if (status === "processing" && predictedDeliveryDate) {
          order.predictedDeliveryDate = new Date(predictedDeliveryDate);
        }
      }
    }

    if (trackingNumber) {
      order.trackingNumber = trackingNumber;
    }

    await order.save();

    res.json({
      message: "Order updated successfully",
      order,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
