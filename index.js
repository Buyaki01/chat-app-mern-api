const express = require('express')
const mongoose = require('mongoose')
const dotenv = require('dotenv')
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
const cors = require('cors')
const User = require('./models/User')

dotenv.config()
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB')
  })
  .catch((error) => {
    console.error('Error connecting to MongoDB:', error.message)
  })

const jwtSecret = process.env.JWT_SECRET_KEY

const app = express()
app.use(express.json())
app.use(cookieParser())
app.use(cors({
  credentials: true,
  origin: process.env.ALLOWED_ORIGINS,
}))

app.get('/test', (req,res) => {
  res.json('test ok')
})

app.get('/profile', (req, res) => {
  const { token } = req.cookies

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized - JWT must be provided' })
  }

  jwt.verify(token, jwtSecret, {}, (err, userData) => {
    if (err) throw err
    res.json({userData})
  })
})

app.post('/register', async (req, res) => {
  const { username, password } = req.body

  try {
    const user = await User.create({username, password})

    jwt.sign({username: user.username}, jwtSecret, {}, (err, token) => {
      if (err) throw err
      res.cookie('token', token, {sameSite: 'none', secure:true}).status(201).json({
        username: user.username,
      })
    })
  } catch (error) {
    if (error) throw error
    res.status(500).json('error')
  }
})

app.listen(5000)