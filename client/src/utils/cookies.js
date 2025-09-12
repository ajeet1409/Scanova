/**
 * Cookie utility functions for managing authentication cookies
 */

// Cookie configuration
const COOKIE_CONFIG = {
  domain: window.location.hostname === 'localhost' ? undefined : window.location.hostname,
  path: '/',
  secure: window.location.protocol === 'https:',
  sameSite: 'lax'
}

/**
 * Set a cookie with the given name, value, and options
 * @param {string} name - Cookie name
 * @param {string} value - Cookie value
 * @param {object} options - Cookie options
 */
export const setCookie = (name, value, options = {}) => {
  try {
    const cookieOptions = {
      ...COOKIE_CONFIG,
      ...options
    }

    let cookieString = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`

    // Add expiration
    if (cookieOptions.maxAge) {
      const expires = new Date(Date.now() + cookieOptions.maxAge * 1000)
      cookieString += `; expires=${expires.toUTCString()}`
    } else if (cookieOptions.expires) {
      cookieString += `; expires=${cookieOptions.expires.toUTCString()}`
    }

    // Add path
    if (cookieOptions.path) {
      cookieString += `; path=${cookieOptions.path}`
    }

    // Add domain
    if (cookieOptions.domain) {
      cookieString += `; domain=${cookieOptions.domain}`
    }

    // Add secure flag
    if (cookieOptions.secure) {
      cookieString += `; secure`
    }

    // Add sameSite
    if (cookieOptions.sameSite) {
      cookieString += `; samesite=${cookieOptions.sameSite}`
    }

    // Add httpOnly flag (note: this won't work from client-side JS, but we include it for completeness)
    if (cookieOptions.httpOnly) {
      cookieString += `; httponly`
    }

    document.cookie = cookieString
    return true
  } catch (error) {
    console.error('Error setting cookie:', error)
    return false
  }
}

/**
 * Get a cookie value by name
 * @param {string} name - Cookie name
 * @returns {string|null} Cookie value or null if not found
 */
export const getCookie = (name) => {
  try {
    const nameEQ = encodeURIComponent(name) + '='
    const cookies = document.cookie.split(';')
    
    for (let cookie of cookies) {
      let c = cookie.trim()
      if (c.indexOf(nameEQ) === 0) {
        return decodeURIComponent(c.substring(nameEQ.length))
      }
    }
    return null
  } catch (error) {
    console.error('Error getting cookie:', error)
    return null
  }
}

/**
 * Remove a cookie by name
 * @param {string} name - Cookie name
 * @param {object} options - Cookie options (path, domain)
 */
export const removeCookie = (name, options = {}) => {
  try {
    const cookieOptions = {
      ...COOKIE_CONFIG,
      ...options,
      expires: new Date(0), // Set to past date to delete
      maxAge: -1
    }

    setCookie(name, '', cookieOptions)
    return true
  } catch (error) {
    console.error('Error removing cookie:', error)
    return false
  }
}

/**
 * Check if cookies are enabled in the browser
 * @returns {boolean} True if cookies are enabled
 */
export const areCookiesEnabled = () => {
  try {
    const testCookie = 'test_cookie_enabled'
    setCookie(testCookie, 'test', { maxAge: 1 })
    const enabled = getCookie(testCookie) === 'test'
    removeCookie(testCookie)
    return enabled
  } catch (error) {
    return false
  }
}

/**
 * Get all cookies as an object
 * @returns {object} Object with cookie names as keys and values as values
 */
export const getAllCookies = () => {
  try {
    const cookies = {}
    const cookieArray = document.cookie.split(';')
    
    for (let cookie of cookieArray) {
      const [name, value] = cookie.trim().split('=')
      if (name && value) {
        cookies[decodeURIComponent(name)] = decodeURIComponent(value)
      }
    }
    
    return cookies
  } catch (error) {
    console.error('Error getting all cookies:', error)
    return {}
  }
}

// Authentication-specific cookie functions
export const AUTH_COOKIES = {
  ACCESS_TOKEN: 'auth_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_ID: 'user_id',
  USER_EMAIL: 'user_email'
}

/**
 * Set authentication cookies
 * @param {object} authData - Authentication data
 */
export const setAuthCookies = (authData) => {
  const { accessToken, refreshToken, user } = authData
  
  try {
    // Set access token (shorter expiry)
    if (accessToken) {
      setCookie(AUTH_COOKIES.ACCESS_TOKEN, accessToken, {
        maxAge: 15 * 60, // 15 minutes
        secure: true,
        sameSite: 'lax'
      })
    }

    // Set refresh token (longer expiry)
    if (refreshToken) {
      setCookie(AUTH_COOKIES.REFRESH_TOKEN, refreshToken, {
        maxAge: 7 * 24 * 60 * 60, // 7 days
        secure: true,
        sameSite: 'lax'
      })
    }

    // Set user info
    if (user) {
      setCookie(AUTH_COOKIES.USER_ID, user._id || user.id, {
        maxAge: 7 * 24 * 60 * 60, // 7 days
        secure: true,
        sameSite: 'lax'
      })
      
      setCookie(AUTH_COOKIES.USER_EMAIL, user.email, {
        maxAge: 7 * 24 * 60 * 60, // 7 days
        secure: true,
        sameSite: 'lax'
      })
    }

    return true
  } catch (error) {
    console.error('Error setting auth cookies:', error)
    return false
  }
}

/**
 * Get authentication cookies
 * @returns {object} Authentication data from cookies
 */
export const getAuthCookies = () => {
  return {
    accessToken: getCookie(AUTH_COOKIES.ACCESS_TOKEN),
    refreshToken: getCookie(AUTH_COOKIES.REFRESH_TOKEN),
    userId: getCookie(AUTH_COOKIES.USER_ID),
    userEmail: getCookie(AUTH_COOKIES.USER_EMAIL)
  }
}

/**
 * Clear all authentication cookies
 */
export const clearAuthCookies = () => {
  try {
    Object.values(AUTH_COOKIES).forEach(cookieName => {
      removeCookie(cookieName)
    })
    return true
  } catch (error) {
    console.error('Error clearing auth cookies:', error)
    return false
  }
}
