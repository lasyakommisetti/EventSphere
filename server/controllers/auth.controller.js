const jwt = require('jsonwebtoken')
const User = require('../models/User')

const signAccessToken = (user) =>
  jwt.sign(
    { id: user._id, email: user.email, role: user.role, name: user.name },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' }
  )

const signRefreshToken = (user) =>
  jwt.sign(
    { id: user._id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d' }
  )

const setRefreshCookie = (res, token) => {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  })
}

exports.register = async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body

    const existing = await User.findOne({ email })
    if (existing) {
      return res.status(409).json({ message: 'Email already registered' })
    }

    const user = await User.create({
      name,
      email,
      passwordHash: password, // pre-save hook hashes it
      role: role || 'participant',
      phone,
    })

    const accessToken = signAccessToken(user)
    const refreshToken = signRefreshToken(user)
    setRefreshCookie(res, refreshToken)

    res.status(201).json({ user, accessToken })
  } catch (err) {
    console.error('register error:', err)
    res.status(500).json({ message: 'Registration failed' })
  }
}

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body

    const user = await User.findOne({ email })
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    const accessToken = signAccessToken(user)
    const refreshToken = signRefreshToken(user)
    setRefreshCookie(res, refreshToken)

    res.json({ user, accessToken })
  } catch (err) {
    console.error('login error:', err)
    res.status(500).json({ message: 'Login failed' })
  }
}

exports.refresh = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken
    if (!token) return res.status(401).json({ message: 'No refresh token' })

    let decoded
    try {
      decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET)
    } catch {
      return res.status(401).json({ message: 'Invalid or expired refresh token' })
    }

    const user = await User.findById(decoded.id)
    if (!user) return res.status(401).json({ message: 'User not found' })

    const accessToken = signAccessToken(user)
    const newRefreshToken = signRefreshToken(user)
    setRefreshCookie(res, newRefreshToken)

    res.json({ accessToken })
  } catch (err) {
    res.status(500).json({ message: 'Token refresh failed' })
  }
}

exports.logout = (req, res) => {
  res.clearCookie('refreshToken')
  res.json({ message: 'Logged out' })
}

exports.me = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-passwordHash')
    if (!user) return res.status(404).json({ message: 'User not found' })
    res.json({ user })
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch user' })
  }
}
