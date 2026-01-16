/**
 * Safe Exam Browser (SEB) Detection & Anti-Cheat Service
 * 
 * This service provides:
 * - SEB browser detection
 * - Browser Exam Key (BEK) retrieval
 * - Anti-cheat utilities
 * - Security enforcement
 */

// SEB Detection
export const SEBService = {
  /**
   * Check if running in Safe Exam Browser
   * Works for Windows, macOS, and iOS
   */
  isSEBBrowser() {
    // Check for SEB user agent
    const userAgent = navigator.userAgent.toLowerCase()
    const isSEB = userAgent.includes('seb') || 
                  userAgent.includes('safeexambrowser')
    
    // Check for SEB JavaScript API
    const hasSEBAPI = typeof window.SafeExamBrowser !== 'undefined'
    
    // Check for Exam Browser (Android alternative)
    const isExamBrowser = userAgent.includes('exambrowser') ||
                          userAgent.includes('fully kiosk')
    
    return isSEB || hasSEBAPI || isExamBrowser
  },

  /**
   * Get Browser Exam Key from SEB
   */
  getBrowserExamKey() {
    if (typeof window.SafeExamBrowser !== 'undefined' &&
        window.SafeExamBrowser.security) {
      return window.SafeExamBrowser.security.browserExamKey || null
    }
    return null
  },

  /**
   * Get Config Key from SEB
   */
  getConfigKey() {
    if (typeof window.SafeExamBrowser !== 'undefined' &&
        window.SafeExamBrowser.security) {
      return window.SafeExamBrowser.security.configKey || null
    }
    return null
  },

  /**
   * Get SEB version
   */
  getSEBVersion() {
    if (typeof window.SafeExamBrowser !== 'undefined') {
      return window.SafeExamBrowser.version || 'Unknown'
    }
    return null
  },

  /**
   * Detect current browser/platform
   */
  detectPlatform() {
    const userAgent = navigator.userAgent
    
    if (this.isSEBBrowser()) {
      if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
        return { browser: 'SEB iOS', secure: true }
      }
      if (userAgent.includes('Mac')) {
        return { browser: 'SEB macOS', secure: true }
      }
      if (userAgent.includes('Windows')) {
        return { browser: 'SEB Windows', secure: true }
      }
      if (userAgent.toLowerCase().includes('exambrowser')) {
        return { browser: 'Exam Browser Android', secure: true }
      }
      return { browser: 'SEB', secure: true }
    }
    
    // Regular browsers
    if (userAgent.includes('Chrome')) return { browser: 'Chrome', secure: false }
    if (userAgent.includes('Firefox')) return { browser: 'Firefox', secure: false }
    if (userAgent.includes('Safari')) return { browser: 'Safari', secure: false }
    if (userAgent.includes('Edge')) return { browser: 'Edge', secure: false }
    
    return { browser: 'Unknown', secure: false }
  }
}

// Anti-Cheat Utilities
export const AntiCheat = {
  violations: [],
  warningCount: 0,
  onViolation: null,
  
  /**
   * Initialize anti-cheat monitoring
   */
  init(options = {}) {
    this.violations = []
    this.warningCount = 0
    this.onViolation = options.onViolation || (() => {})
    this.maxWarnings = options.maxWarnings || 5
    
    // Start monitoring
    this.blockCopyPaste()
    this.blockContextMenu()
    this.blockKeyboardShortcuts()
    this.monitorVisibility()
    this.monitorWindowFocus()
    this.detectDevTools()
    
    console.log('[AntiCheat] Initialized')
  },

  /**
   * Stop anti-cheat monitoring
   */
  destroy() {
    // Remove all event listeners
    document.removeEventListener('copy', this._copyHandler)
    document.removeEventListener('paste', this._pasteHandler)
    document.removeEventListener('cut', this._cutHandler)
    document.removeEventListener('contextmenu', this._contextHandler)
    document.removeEventListener('keydown', this._keyHandler)
    document.removeEventListener('visibilitychange', this._visibilityHandler)
    window.removeEventListener('blur', this._blurHandler)
    window.removeEventListener('focus', this._focusHandler)
    
    console.log('[AntiCheat] Destroyed')
  },

  /**
   * Report a violation
   */
  reportViolation(type, details = '') {
    const violation = {
      type,
      details,
      timestamp: new Date().toISOString()
    }
    this.violations.push(violation)
    this.warningCount++
    
    console.warn(`[AntiCheat] Violation: ${type}`, details)
    
    if (this.onViolation) {
      this.onViolation(violation, this.warningCount)
    }
    
    return this.warningCount
  },

  /**
   * Block copy/paste/cut
   */
  blockCopyPaste() {
    this._copyHandler = (e) => {
      e.preventDefault()
      this.reportViolation('COPY_ATTEMPT', 'User tried to copy content')
    }
    
    this._pasteHandler = (e) => {
      e.preventDefault()
      this.reportViolation('PASTE_ATTEMPT', 'User tried to paste content')
    }
    
    this._cutHandler = (e) => {
      e.preventDefault()
      this.reportViolation('CUT_ATTEMPT', 'User tried to cut content')
    }
    
    document.addEventListener('copy', this._copyHandler)
    document.addEventListener('paste', this._pasteHandler)
    document.addEventListener('cut', this._cutHandler)
  },

  /**
   * Block right-click context menu
   */
  blockContextMenu() {
    this._contextHandler = (e) => {
      e.preventDefault()
      // Don't report this as it's too common
      return false
    }
    
    document.addEventListener('contextmenu', this._contextHandler)
  },

  /**
   * Block dangerous keyboard shortcuts
   */
  blockKeyboardShortcuts() {
    this._keyHandler = (e) => {
      // Block F12 (DevTools)
      if (e.key === 'F12') {
        e.preventDefault()
        this.reportViolation('DEVTOOLS_ATTEMPT', 'F12 key pressed')
        return false
      }
      
      // Block Ctrl+Shift+I (DevTools)
      if (e.ctrlKey && e.shiftKey && e.key === 'I') {
        e.preventDefault()
        this.reportViolation('DEVTOOLS_ATTEMPT', 'Ctrl+Shift+I pressed')
        return false
      }
      
      // Block Ctrl+Shift+J (Console)
      if (e.ctrlKey && e.shiftKey && e.key === 'J') {
        e.preventDefault()
        this.reportViolation('DEVTOOLS_ATTEMPT', 'Ctrl+Shift+J pressed')
        return false
      }
      
      // Block Ctrl+U (View Source)
      if (e.ctrlKey && e.key === 'u') {
        e.preventDefault()
        this.reportViolation('VIEW_SOURCE_ATTEMPT', 'Ctrl+U pressed')
        return false
      }
      
      // Block Ctrl+S (Save Page)
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault()
        return false
      }
      
      // Block Ctrl+P (Print)
      if (e.ctrlKey && e.key === 'p') {
        e.preventDefault()
        this.reportViolation('PRINT_ATTEMPT', 'Ctrl+P pressed')
        return false
      }
      
      // Block Alt+Tab (on Windows, only works in some cases)
      if (e.altKey && e.key === 'Tab') {
        e.preventDefault()
        return false
      }
      
      // Block Escape (to exit fullscreen)
      if (e.key === 'Escape') {
        // Allow but monitor
        this.reportViolation('ESCAPE_PRESSED', 'Escape key pressed')
      }
    }
    
    document.addEventListener('keydown', this._keyHandler)
  },

  /**
   * Monitor page visibility changes
   */
  monitorVisibility() {
    this._visibilityHandler = () => {
      if (document.hidden) {
        this.reportViolation('TAB_SWITCH', 'User switched to another tab/window')
      }
    }
    
    document.addEventListener('visibilitychange', this._visibilityHandler)
  },

  /**
   * Monitor window focus
   */
  monitorWindowFocus() {
    this._blurHandler = () => {
      this.reportViolation('WINDOW_BLUR', 'Window lost focus')
    }
    
    this._focusHandler = () => {
      // Window regained focus - could log this
    }
    
    window.addEventListener('blur', this._blurHandler)
    window.addEventListener('focus', this._focusHandler)
  },

  /**
   * Detect DevTools opening (experimental)
   */
  detectDevTools() {
    const threshold = 160
    
    const checkDevTools = () => {
      const widthThreshold = window.outerWidth - window.innerWidth > threshold
      const heightThreshold = window.outerHeight - window.innerHeight > threshold
      
      if (widthThreshold || heightThreshold) {
        this.reportViolation('DEVTOOLS_OPEN', 'Developer tools may be open')
      }
    }
    
    // Check periodically
    this._devToolsInterval = setInterval(checkDevTools, 5000)
  },

  /**
   * Request fullscreen mode
   */
  async requestFullscreen() {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen()
        return true
      }
      if (document.documentElement.webkitRequestFullscreen) {
        await document.documentElement.webkitRequestFullscreen()
        return true
      }
    } catch (err) {
      console.warn('[AntiCheat] Fullscreen request failed:', err)
    }
    return false
  },

  /**
   * Check if currently in fullscreen
   */
  isFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement)
  },

  /**
   * Get violation summary
   */
  getViolationSummary() {
    const summary = {}
    this.violations.forEach(v => {
      summary[v.type] = (summary[v.type] || 0) + 1
    })
    return {
      total: this.warningCount,
      byType: summary,
      violations: this.violations
    }
  }
}

// Export default
export default { SEBService, AntiCheat }
