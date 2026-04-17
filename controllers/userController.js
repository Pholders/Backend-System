const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * User Controller
 * Handles user authentication and registration
 */

class UserController {
  /**
   * User Signup/Registration
   */
  static async signup(req, res) {
    try {
      const { 
        first_name, 
        last_name, 
        email, 
        phone, 
        id_passport_number,
        nationality, 
        password 
      } = req.body;

      // Validate required fields
      if (!first_name || !last_name || !email || !phone || !id_passport_number || !nationality || !password) {
        return res.status(400).json({
          success: false,
          message: 'All fields are required: first_name, last_name, email, phone, id_passport_number, nationality, password'
        });
      }

      // Validate nationality
      const validNationalities = ['South African', 'Other'];
      if (!validNationalities.includes(nationality)) {
        return res.status(400).json({
          success: false,
          message: 'Nationality must be either "South African" or "Other"'
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email format'
        });
      }

      // Validate password strength (minimum 6 characters)
      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters long'
        });
      }

      // Check if email already exists
      const existingUserByEmail = await User.findByEmail(email);
      if (existingUserByEmail) {
        return res.status(409).json({
          success: false,
          message: 'Email already registered'
        });
      }

      // Check if ID/Passport number already exists
      const existingUserByIdPassport = await User.findByIdPassport(id_passport_number);
      if (existingUserByIdPassport) {
        return res.status(409).json({
          success: false,
          message: 'ID/Passport number already registered'
        });
      }

      // Hash password
      const saltRounds = 10;
      const password_hash = await bcrypt.hash(password, saltRounds);

      // Create new user
      const newUser = await User.create({
        first_name,
        last_name,
        email,
        phone,
        id_passport_number,
        nationality,
        password_hash
      });

      // Remove password_hash from response
      delete newUser.password_hash;

      // Generate JWT token
      const token = jwt.sign(
        { 
          id: newUser.id, 
          email: newUser.email,
          type: 'user'
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user: newUser,
          token
        }
      });

    } catch (error) {
      console.error('Signup error:', error);
      res.status(500).json({
        success: false,
        message: 'Error registering user',
        error: error.message
      });
    }
  }

  /**
   * User Login
   */
  static async login(req, res) {
    try {
      const { email, password } = req.body;

      // Validate required fields
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email and password are required'
        });
      }

      // Find user by email
      const user = await User.findByEmail(email);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      // Check if user is active
      if (user.status !== 'active') {
        return res.status(403).json({
          success: false,
          message: 'Account is inactive. Please contact support.'
        });
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      // Remove password_hash from response
      delete user.password_hash;

      // Generate JWT token
      const token = jwt.sign(
        { 
          id: user.id, 
          email: user.email,
          type: 'user'
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          user,
          token
        }
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Error logging in',
        error: error.message
      });
    }
  }

  /**
   * Get User Profile
   */
  static async getProfile(req, res) {
    try {
      const userId = req.user.id; // Assuming middleware sets req.user

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Remove password_hash from response
      delete user.password_hash;

      res.status(200).json({
        success: true,
        data: user
      });

    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching profile',
        error: error.message
      });
    }
  }

  /**
   * Update User Profile
   */
  static async updateProfile(req, res) {
    try {
      const userId = req.user.id;
      const updateData = req.body;

      // Remove fields that shouldn't be updated directly
      delete updateData.id;
      delete updateData.password_hash;
      delete updateData.email; // Email changes might need verification
      delete updateData.id_passport_number; // ID/Passport shouldn't be changed
      delete updateData.created_at;

      const updatedUser = await User.update(userId, updateData);
      if (!updatedUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Remove password_hash from response
      delete updatedUser.password_hash;

      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: updatedUser
      });

    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating profile',
        error: error.message
      });
    }
  }
}

module.exports = UserController;
