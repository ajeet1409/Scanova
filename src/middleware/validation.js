const validateTextInput = (req, res, next) => {
  const { text } = req.body;
  
  if (!text) {
    return res.status(400).json({
      success: false,
      error: 'Text is required',
      message: 'Please provide text to process'
    });
  }
  
  if (typeof text !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Invalid text format',
      message: 'Text must be a string'
    });
  }
  
  if (text.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Empty text',
      message: 'Text cannot be empty'
    });
  }
  
  if (text.length > 10000) {
    return res.status(400).json({
      success: false,
      error: 'Text too long',
      message: 'Text must be less than 10,000 characters'
    });
  }
  
  next();
};

const validatePagination = (req, res, next) => {
  const page = parseInt(req.query.page);
  const limit = parseInt(req.query.limit);
  
  if (page && (isNaN(page) || page < 1)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid page number',
      message: 'Page must be a positive integer'
    });
  }
  
  if (limit && (isNaN(limit) || limit < 1 || limit > 100)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid limit',
      message: 'Limit must be between 1 and 100'
    });
  }
  
  next();
};

const validateObjectId = (req, res, next) => {
  const { id } = req.params;
  
  if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid ID format',
      message: 'Please provide a valid MongoDB ObjectId'
    });
  }
  
  next();
};

const validateRegistration = (req, res, next) => {
  const { username, email, password, firstName, lastName } = req.body;
  const errors = [];

  // Username validation
  if (!username) {
    errors.push('Username is required');
  } else if (username.length < 3 || username.length > 30) {
    errors.push('Username must be between 3 and 30 characters');
  } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    errors.push('Username can only contain letters, numbers, and underscores');
  }

  // Email validation
  if (!email) {
    errors.push('Email is required');
  } else if (!/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(email)) {
    errors.push('Please enter a valid email address');
  }

  // Password validation
  if (!password) {
    errors.push('Password is required');
  } else if (password.length < 6) {
    errors.push('Password must be at least 6 characters long');
  }

  // First name validation
  if (!firstName) {
    errors.push('First name is required');
  } else if (firstName.length > 50) {
    errors.push('First name cannot exceed 50 characters');
  }

  // Last name validation
  if (!lastName) {
    errors.push('Last name is required');
  } else if (lastName.length > 50) {
    errors.push('Last name cannot exceed 50 characters');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors
    });
  }

  next();
};

const validateLogin = (req, res, next) => {
  const { email, password } = req.body;
  const errors = [];

  if (!email) {
    errors.push('Email is required');
  } else if (!/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(email)) {
    errors.push('Please enter a valid email address');
  }

  if (!password) {
    errors.push('Password is required');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors
    });
  }

  next();
};

const validatePasswordChange = (req, res, next) => {
  const { currentPassword, newPassword } = req.body;
  const errors = [];

  if (!currentPassword) {
    errors.push('Current password is required');
  }

  if (!newPassword) {
    errors.push('New password is required');
  } else if (newPassword.length < 6) {
    errors.push('New password must be at least 6 characters long');
  }

  if (currentPassword === newPassword) {
    errors.push('New password must be different from current password');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors
    });
  }

  next();
};

module.exports = {
  validateTextInput,
  validatePagination,
  validateObjectId,
  validateRegistration,
  validateLogin,
  validatePasswordChange
};
