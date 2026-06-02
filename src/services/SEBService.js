/**
 * Safe Exam Browser (SEB) Detection & Anti-Cheat Service
 * 
 * OPTIMIZED: 
 * - iOS/SEB-aware: skips false positive blur/visibility events
 * - Cooldown between violations to prevent rapid-fire auto-submit
 * - Debounced visibility handler
 */

// SEB Detection
export const SEBService = {
  /**
   * Check if running in Safe Exam Browser
   * Works for Windows, macOS, and iOS
   */
  isSEBBrowser() {
    const userAgent = navigator.userAgent.toLowerCase()
    const isSEB = userAgent.includes('seb') ||
      userAgent.includes('safeexambrowser')

    const hasSEBAPI = typeof window.SafeExamBrowser !== 'undefined'

    const isExamBrowser = userAgent.includes('exambrowser') ||
      userAgent.includes('fully kiosk') ||
      userAgent.includes('exambro') ||
      userAgent.includes('cbt browser') ||
      userAgent.includes('cbtbrowser') ||
      userAgent.includes('exam browser') ||
      userAgent.includes('kiosk') ||
      userAgent.includes('examlock')

    const isAndroidWebView = (userAgent.includes('wv') && userAgent.includes('android')) ||
      (window.navigator.standalone === true)

    return isSEB || hasSEBAPI || isExamBrowser || isAndroidWebView
  },

  /**
   * Detect if running on iOS
   */
  isIOS() {
    const ua = navigator.userAgent
    return /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  },

  /**
   * Detect if running on mobile
   */
  isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints > 1)
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
        return { browser: 'SEB iOS', secure: true, isIOS: true, isMobile: true }
      }
      if (userAgent.includes('Mac')) {
        return { browser: 'SEB macOS', secure: true, isIOS: false, isMobile: false }
      }
      if (userAgent.includes('Windows')) {
        return { browser: 'SEB Windows', secure: true, isIOS: false, isMobile: false }
      }
      if (userAgent.toLowerCase().includes('exambrowser') || userAgent.toLowerCase().includes('exambro')) {
        return { browser: 'Exam Browser Android', secure: true, isIOS: false, isMobile: true }
      }
      return { browser: 'SEB', secure: true, isIOS: false, isMobile: false }
    }

    // Regular browsers
    const isIOS = this.isIOS()
    const isMobile = this.isMobile()
    if (userAgent.includes('Chrome')) return { browser: 'Chrome', secure: false, isIOS, isMobile }
    if (userAgent.includes('Firefox')) return { browser: 'Firefox', secure: false, isIOS, isMobile }
    if (userAgent.includes('Safari')) return { browser: 'Safari', secure: false, isIOS, isMobile }
    if (userAgent.includes('Edge')) return { browser: 'Edge', secure: false, isIOS, isMobile }

    return { browser: 'Unknown', secure: false, isIOS, isMobile }
  }
}

// Anti-Cheat Utilities
export const AntiCheat = {
  violations: [],
  warningCount: 0,
  onViolation: null,
  onLockdownChange: null,
  isLocked: false,
  level: 'medium',
  _lastViolationTime: 0,
  _violationCooldown: 5000, // 5 second cooldown between violations
  _isSEB: false,
  _isIOS: false,
  _isMobile: false,
  _visibilityDebounceTimer: null,

  /**
   * Initialize anti-cheat monitoring
   * @param {Object} options 
   * @param {string} options.level - 'low', 'medium', 'high'
   * @param {number} options.maxWarnings - max warnings before auto-submit
   * @param {Function} options.onViolation - callback on violation
   * @param {Function} options.onLockdownChange - callback when lockdown state changes
   */
  init(options = {}) {
    this.violations = []
    this.warningCount = 0
    this.onViolation = options.onViolation || (() => { })
    this.onLockdownChange = options.onLockdownChange || (() => { })
    this.maxWarnings = options.maxWarnings || 3
    this.level = options.level || 'medium'
    this.isLocked = false
    this._lastViolationTime = 0

    // Detect platform once
    this._isSEB = SEBService.isSEBBrowser()
    this._isIOS = SEBService.isIOS()
    this._isMobile = SEBService.isMobile()

    console.log(`[AntiCheat] Platform: SEB=${this._isSEB}, iOS=${this._isIOS}, Mobile=${this._isMobile}`)

    // Set cooldown based on platform
    // iOS/mobile get longer cooldown because they fire more false events
    if (this._isIOS || this._isMobile) {
      this._violationCooldown = 10000 // 10 seconds for mobile
    } else {
      this._violationCooldown = 5000  // 5 seconds for desktop
    }

    // All levels: block copy/paste
    this.blockCopyPaste()

    // Only monitor visibility on desktop browsers (NOT SEB, NOT iOS)
    // SEB and iOS fire false visibility events constantly
    if (!this._isSEB && !this._isIOS) {
      this.monitorVisibility()
    }

    // Medium + High: block shortcuts, context menu, devtools
    if (this.level === 'medium' || this.level === 'high') {
      this.blockContextMenu()
      this.blockKeyboardShortcuts()
      // Only check devtools on desktop
      if (!this._isMobile) {
        this.detectDevTools()
      }
      this.disableTextSelection()
    }

    // High: fullscreen enforcement, window monitoring
    if (this.level === 'high') {
      // Only monitor window focus on desktop (not mobile/SEB)
      if (!this._isMobile && !this._isSEB) {
        this.monitorWindowFocus()
      }
      this.enforceFullscreen()
      if (!this._isMobile) {
        this.monitorWindowResize()
        this.detectMultiMonitor()
      }
    } else if (!this._isSEB && !this._isMobile) {
      // Non-high levels: only monitor focus on non-SEB desktop
      this.monitorWindowFocus()
    }

    console.log(`[AntiCheat] Initialized at level: ${this.level}, maxWarnings: ${this.maxWarnings}`)
  },

  /**
   * Stop anti-cheat monitoring
   */
  destroy() {
    document.removeEventListener('copy', this._copyHandler)
    document.removeEventListener('paste', this._pasteHandler)
    document.removeEventListener('cut', this._cutHandler)
    document.removeEventListener('contextmenu', this._contextHandler)
    document.removeEventListener('keydown', this._keyHandler)
    document.removeEventListener('visibilitychange', this._visibilityHandler)
    document.removeEventListener('fullscreenchange', this._fullscreenChangeHandler)
    window.removeEventListener('blur', this._blurHandler)
    window.removeEventListener('focus', this._focusHandler)
    window.removeEventListener('resize', this._resizeHandler)

    if (this._devToolsInterval) clearInterval(this._devToolsInterval)
    if (this._multiMonitorInterval) clearInterval(this._multiMonitorInterval)
    if (this._visibilityDebounceTimer) clearTimeout(this._visibilityDebounceTimer)

    const styleEl = document.getElementById('anticheat-noselect')
    if (styleEl) styleEl.remove()

    this.isLocked = false
    console.log('[AntiCheat] Destroyed')
  },

  /**
   * Report a violation with cooldown protection
   * Prevents rapid-fire false positives from triggering auto-submit
   */
  reportViolation(type, details = '') {
    const now = Date.now()

    // COOLDOWN: Ignore violations that come too fast (iOS keyboard, SEB glitches, etc.)
    if (now - this._lastViolationTime < this._violationCooldown) {
      console.log(`[AntiCheat] Violation ${type} ignored (cooldown active, ${now - this._lastViolationTime}ms since last)`)
      return this.warningCount
    }

    this._lastViolationTime = now

    const violation = {
      type,
      details,
      timestamp: new Date().toISOString()
    }
    this.violations.push(violation)
    this.warningCount++

    console.warn(`[AntiCheat] Violation #${this.warningCount}: ${type}`, details)

    if (this.onViolation) {
      this.onViolation(violation, this.warningCount)
    }

    return this.warningCount
  },

  /**
   * Block copy/paste/cut (no violation count for these, just prevent)
   */
  blockCopyPaste() {
    this._copyHandler = (e) => {
      e.preventDefault()
      // Only count as violation on desktop, not mobile (accidental touch)
      if (!this._isMobile) {
        this.reportViolation('COPY_ATTEMPT', 'User tried to copy content')
      }
    }

    this._pasteHandler = (e) => {
      e.preventDefault()
      if (!this._isMobile) {
        this.reportViolation('PASTE_ATTEMPT', 'User tried to paste content')
      }
    }

    this._cutHandler = (e) => {
      e.preventDefault()
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
        return false
      }

      // Block Alt+Tab (on Windows)
      if (e.altKey && e.key === 'Tab') {
        e.preventDefault()
        return false
      }

      // Block Escape in high mode
      if (this.level === 'high' && e.key === 'Escape') {
        this.reportViolation('ESCAPE_PRESSED', 'Escape key pressed during lockdown')
      }
    }

    document.addEventListener('keydown', this._keyHandler)
  },

  /**
   * Monitor page visibility changes
   * DEBOUNCED: Wait 2 seconds before counting as violation
   * iOS fires visibilitychange when keyboard appears/disappears
   */
  monitorVisibility() {
    this._visibilityHandler = () => {
      if (document.hidden) {
        // Debounce: only count if tab stays hidden for > 2 seconds
        // This filters out iOS keyboard popup, address bar changes, etc.
        if (this._visibilityDebounceTimer) clearTimeout(this._visibilityDebounceTimer)
        this._visibilityDebounceTimer = setTimeout(() => {
          if (document.hidden) {
            this.reportViolation('TAB_SWITCH', 'User switched to another tab/window')
          }
        }, 2000)
      } else {
        // Tab came back - cancel the pending violation
        if (this._visibilityDebounceTimer) {
          clearTimeout(this._visibilityDebounceTimer)
          this._visibilityDebounceTimer = null
        }
      }
    }

    document.addEventListener('visibilitychange', this._visibilityHandler)
  },

  /**
   * Monitor window focus (desktop only, NOT on SEB/iOS/mobile)
   * DEBOUNCED: 3 second delay to filter false positives
   */
  monitorWindowFocus() {
    let blurTimer = null

    this._blurHandler = () => {
      // Debounce: only count if window stays blurred for > 3 seconds
      if (blurTimer) clearTimeout(blurTimer)
      blurTimer = setTimeout(() => {
        if (!document.hasFocus()) {
          this.reportViolation('WINDOW_BLUR', 'Window lost focus')
        }
      }, 3000)
    }

    this._focusHandler = () => {
      // Window regained focus - cancel pending violation
      if (blurTimer) {
        clearTimeout(blurTimer)
        blurTimer = null
      }
    }

    window.addEventListener('blur', this._blurHandler)
    window.addEventListener('focus', this._focusHandler)
  },

  /**
   * Detect DevTools opening (desktop only)
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

    this._devToolsInterval = setInterval(checkDevTools, 10000) // Check every 10s (was 5s)
  },

  /**
   * Disable text selection on exam page
   */
  disableTextSelection() {
    if (document.getElementById('anticheat-noselect')) return
    const style = document.createElement('style')
    style.id = 'anticheat-noselect'
    style.textContent = `
      .take-exam-page {
        -webkit-user-select: none !important;
        -moz-user-select: none !important;
        -ms-user-select: none !important;
        user-select: none !important;
      }
      .take-exam-page input,
      .take-exam-page textarea {
        -webkit-user-select: text !important;
        -moz-user-select: text !important;
        user-select: text !important;
      }
    `
    document.head.appendChild(style)
  },

  /**
   * Enforce fullscreen mode (high level only)
   */
  enforceFullscreen() {
    this._fullscreenChangeHandler = () => {
      const isFS = !!(document.fullscreenElement || document.webkitFullscreenElement)

      if (!isFS && this.level === 'high') {
        this.isLocked = true
        if (this.onLockdownChange) {
          this.onLockdownChange(true)
        }
        this.reportViolation('FULLSCREEN_EXIT', 'User exited fullscreen during lockdown mode')
      } else if (isFS && this.isLocked) {
        this.isLocked = false
        if (this.onLockdownChange) {
          this.onLockdownChange(false)
        }
      }
    }

    document.addEventListener('fullscreenchange', this._fullscreenChangeHandler)
    document.addEventListener('webkitfullscreenchange', this._fullscreenChangeHandler)
  },

  /**
   * Monitor window resize (detect split-screen)
   */
  monitorWindowResize() {
    let lastWidth = window.innerWidth
    let lastHeight = window.innerHeight
    let resizeTimeout = null

    this._resizeHandler = () => {
      if (resizeTimeout) clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(() => {
        const newWidth = window.innerWidth
        const newHeight = window.innerHeight

        const widthReduction = (lastWidth - newWidth) / lastWidth
        const heightReduction = (lastHeight - newHeight) / lastHeight

        if (widthReduction > 0.3 || heightReduction > 0.3) {
          this.reportViolation('WINDOW_RESIZE', `Window resized: ${lastWidth}x${lastHeight} → ${newWidth}x${newHeight}`)
        }

        lastWidth = newWidth
        lastHeight = newHeight
      }, 500)
    }

    window.addEventListener('resize', this._resizeHandler)
  },

  /**
   * Detect multiple monitors
   */
  detectMultiMonitor() {
    const checkMultiMonitor = () => {
      if (window.screen && window.screen.isExtended !== undefined) {
        if (window.screen.isExtended) {
          this.reportViolation('MULTI_MONITOR', 'Multiple monitors detected')
        }
      }
    }

    checkMultiMonitor()
    this._multiMonitorInterval = setInterval(checkMultiMonitor, 30000) // 30s (was 10s)
  },

  /**
   * Request fullscreen mode
   */
  async requestFullscreen() {
    try {
      // Don't request fullscreen on iOS (not supported properly)
      if (this._isIOS) {
        console.log('[AntiCheat] Skipping fullscreen on iOS')
        return false
      }

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

export default { SEBService, AntiCheat }
