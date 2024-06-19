const express = require('express');
const axios = require('axios');
const Transaction = require('../models/Transaction');
const mongoose = require('mongoose');

const router = express.Router();

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify: false,
})
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));


router.get('/init', async (req, res) => {
  try {
    const response = await axios.get('https://s3.amazonaws.com/roxiler.com/product_transaction.json');
    const transactions = response.data;

    await Transaction.deleteMany();
    await Transaction.insertMany(transactions);

    res.status(200).send('Database initialized with seed data');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error initializing database');
  }
});



router.get('/transactions', async (req, res) => {
    const {search = '', page = 1, per_page = 10 } = req.query;
  
   
    try {
      const query = {
      $or: [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          
        ]
      };
  
      const total = await Transaction.countDocuments(query);
      const transactions = await Transaction.find(query)
        .skip((page - 1) * per_page)
        .limit(parseInt(per_page));
  
      res.status(200).json({ transactions, total });
    } catch (error) {
      console.error(error);
      res.status(500).send('Error fetching transactions');
    }
  });
  router.get('/statistics', async (req, res) => {
    const { month } = req.query;
    if(!month){
      return res.status(400).send('please select a valid month');
    }
    const startDate = new Date(2021, month , 1);
    const endDate = new Date(2021, month+1, 1);
    
    try {
      const totalSalesAmount = await Transaction.aggregate([
        { $match: { dateOfSale: { $gte: startDate, $lt: endDate } } },
        { $group: { _id: null, total: { $sum: "$price" } } }
      ]);
  
      const soldItems = await Transaction.countDocuments({
        dateOfSale: { $gte: startDate, $lt: endDate },
        sold: true
      });
  
      const notSoldItems = await Transaction.countDocuments({
        dateOfSale: { $gte: startDate, $lt: endDate },
        sold: false
      });
  
      res.status(200).json({
        totalSalesAmount: totalSalesAmount[0]?.total || 0,
        soldItems,
        notSoldItems
      });
    } catch (error) {
      console.error(error);
      res.status(500).send('Error fetching statistics');
    }
  });
  router.get('/bar-chart', async (req, res) => {
    const { month } = req.query;
  
    const startDate = new Date(2021, month, 1);
    const endDate = new Date(2021, month+1, 1);
  
    const ranges = [
      { range: '0-100', min: 0, max: 100 },
      { range: '101-200', min: 101, max: 200 },
      { range: '201-300', min: 201, max: 300 },
      { range: '301-400', min: 301, max: 400 },
      { range: '401-500', min: 401, max: 500 },
      { range: '501-600', min: 501, max: 600 },
      { range: '601-700', min: 601, max: 700 },
      { range: '701-800', min: 701, max: 800 },
      { range: '801-900', min: 801, max: 900 },
      { range: '901-above', min: 901, max: Infinity },
    ];
  
    try {
      const barChartData = await Promise.all(ranges.map(async (range) => {
        const count = await Transaction.countDocuments({
          dateOfSale: { $gte: startDate, $lt: endDate },
          price: { $gte: range.min, $lt: range.max }
        });
  
        return { range: range.range, count };
      }));
  
      res.status(200).json(barChartData);
    } catch (error) {
      console.error(error);
      res.status(500).send('Error fetching bar chart data');
    }
  });


module.exports = router;