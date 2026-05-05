const jwt = require('jsonwebtoken');
const RefreshToken = require('../models/RefreshToken');

class RefreshController {
  static async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          message: 'Refresh token is required'
        });
      }
      
      // Find and validate refresh token
      const tokenData = await RefreshToken.findValidToken(refreshToken);
      
      if (!tokenData) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired refresh token'
        });
      }
      
      // Generate new access token
      const newAccessToken = jwt.sign(
        {
          id: tokenData.user_id,
          email: tokenData.email,
          type: tokenData.user_type
        },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );
      
      // Optionally rotate refresh token (recommended)
      await RefreshToken.revoke(tokenData.id);
      const newRefreshTokenData = await RefreshToken.create(
        tokenData.user_id,
        tokenData.user_type,
        req.headers['user-agent']
      );
      
      res.json({
        success: true,
        data: {
          accessToken: newAccessToken,
          refreshToken: newRefreshTokenData.token,
          expiresIn: 900
        }
      });
      
    } catch (error) {
      console.error('Refresh token error:', error);
      res.status(500).json({
        success: false,
        message: 'Error refreshing token'
      });
    }
  }
  
  static async logout(req, res) {
    try {
      const { refreshToken } = req.body;
      
      if (refreshToken) {
        const tokenData = await RefreshToken.findValidToken(refreshToken);
        if (tokenData) {
          await RefreshToken.revoke(tokenData.id);
        }
      }
      
      res.json({
        success: true,
        message: 'Logged out successfully'
      });
      
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        message: 'Error during logout'
      });
    }
  }
}

module.exports = RefreshController;