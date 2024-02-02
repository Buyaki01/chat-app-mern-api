const express = require('express')
const mongoose = require('mongoose')
const dotenv = require('dotenv')
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
const cors = require('cors')
const bcrypt = require('bcryptjs')
const User = require('./models/User')
const ws = require('ws')
const PORT = process.env.PORT || 5000

dotenv.config()
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB')
  })
  .catch((error) => {
    console.error('Error connecting to MongoDB:', error.message)
  })

const jwtSecret = process.env.JWT_SECRET_KEY
const bcryptSalt = bcrypt.genSaltSync(10)

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
    const hashedPassword = bcrypt.hashSync(password, bcryptSalt)

    const user = await User.create({
      username, 
      password: hashedPassword
    })

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

app.post('/login', async (req, res) => {
  const { username, password } = req.body
  const user = await User.findOne({username})

  if (user) {
    const passOk = bcrypt.compareSync(password, user.password)

    if (passOk) {
      jwt.sign({username: user.username}, jwtSecret, {}, (err, token) => {
        if (err) throw err
        res.cookie('token', token, {sameSite: 'none', secure:true}).status(201).json({
          username: user.username,
        })
      })
    }
  }
})

const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`))

const wss = new ws.WebSocketServer({server})

wss.on('connection', (connection, req) => {
  const cookies = req.headers.cookie

  if (cookies) {
    const tokenCookieString = cookies.split(';').find(str => str.startsWith('token=')) //splits the cookies string into an array of individual cookie strings, using semicolons as the delimiter
    if (tokenCookieString) {
      const token = tokenCookieString.split('=')[1]
      if (token) {
        jwt.verify(token, jwtSecret, {}, (err, userData) => {
          if (err) throw err
          const { username } = userData
          connection.username = username
          
        })
      }
    }
  }

  [...wss.clients].forEach(client => {
    client.send(JSON.stringify({
      online: [...wss.clients].map(c => ({ username: c.username}))
    }))
  })
})