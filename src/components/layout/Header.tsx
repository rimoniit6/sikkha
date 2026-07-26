'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useTheme } from 'next-themes'
import { Search, Menu, X, Sun, Moon, User, GraduationCap, BookOpen, LogIn, LogOut, LayoutDashboard, Crown, Target } from 'lucide-react'
import NotificationBell from '@/components/notifications/NotificationBell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from '@/components/ui/sheet'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useRouterStore, useCurrentRoute } from '@/store/router'
import type { RoutePath } from '@/store/router'
import { useAuthStore, useShallowAuth } from '@/store/auth'
import { useLearningPreference } from '@/providers/LearningPreferenceProvider'
import { useHierarchyMetadata } from '@/hooks/use-hierarchy-metadata'
import { useSiteConfig } from '@/hooks/use-metadata'
import { useNavigation } from '@/hooks/use-navigation'
import { useFocusMode } from '@/store/focus-mode'
import Image from 'next/image'

const getUserInitials = (name: string) =>
  name.replace(/[^\p{L}\p{N}\s]/gu, '').split(/\s+/).filter(Boolean).map((n) => n[0]).join('').toUpperCase().slice(0, 2)

export default function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const lastScrollY = useRef(0)
  const { theme, setTheme } = useTheme()
  const currentRoute = useCurrentRoute()
  const navigate = useRouterStore((s) => s.navigate)
  const { user, isAuthenticated } = useShallowAuth()
  const logout = useAuthStore((s) => s.logout)
  const { config } = useSiteConfig()
  const { headerNav, loading: navLoading } = useNavigation()
  const { learningMode, classLevel, setPreference } = useLearningPreference()
  const { active: focusActive, enterFocusMode } = useFocusMode()
  const { classLevelLabels, classOptions } = useHierarchyMetadata()

  const currentClassLabel = classLevel ? (classLevelLabels[classLevel] || classLevel) : null
  const isClassBased = learningMode === 'CLASS_BASED'

  const siteName = config?.siteName || 'শিক্ষা বাংলা'
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN'
  const isDark = theme === 'dark'

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    let frameId: number
    const handleScroll = () => {
      cancelAnimationFrame(frameId)
      frameId = requestAnimationFrame(() => {
        const currentY = window.scrollY
        setScrolled(currentY > 10)
        // Hide on scroll down, show on scroll up
        if (currentY > 80) {
          if (currentY > lastScrollY.current) setHidden(true)
          else setHidden(false)
        } else {
          setHidden(false)
        }
        lastScrollY.current = currentY
      })
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => { window.removeEventListener('scroll', handleScroll); cancelAnimationFrame(frameId) }
  }, [])

  // Auto-focus search input when opened on mobile
  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [searchOpen])

  const handleNavClick = useCallback((route: string) => {
    navigate(route as RoutePath)
  }, [navigate])

  const handleLogout = useCallback(() => { logout(); navigate('home') }, [logout, navigate])

  const handleSearch = useCallback(() => {
    if (searchQuery.trim()) { navigate('search', { searchQuery: searchQuery.trim() }); setSearchOpen(false); setSearchQuery('') }
  }, [searchQuery, navigate])

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => { if (e.key === 'Enter') handleSearch() }, [handleSearch])

  // Route prefix matching for active state: e.g. 'blog' matches 'blog', 'blog-detail', 'blog-category', etc.
  const isRouteActive = useCallback((navRoute: string, current: RoutePath): boolean => {
    if (current === navRoute) return true
    // For parent routes with sub-routes, check prefix match
    if (navRoute === 'blog' && current.startsWith('blog-')) return true
    if (navRoute === 'class-list' && (current.startsWith('class-') || current.startsWith('subject-') || current.startsWith('chapter-'))) return true
    if (navRoute === 'exam-center' && (current.startsWith('exam-') || current.startsWith('mcq-exam-') || current.startsWith('cq-exam-'))) return true
    if (navRoute === 'notices' && current.startsWith('notice-')) return true
    if (navRoute === 'suggestions' && current.startsWith('suggestion-')) return true
    if (navRoute === 'course-list' && current.startsWith('course-')) return true
    if (navRoute === 'cq-list' && current.startsWith('cq-') && !current.startsWith('cq-exam-')) return true
    return false
  }, [])

  const visibleNav = useMemo(() =>
    headerNav.filter(item => {
      if (item.isAdminOnly && !isAdmin) return false
      if (item.isAuthOnly && !isAuthenticated) return false
      return true
    }), [headerNav, isAdmin, isAuthenticated])

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        hidden ? '-translate-y-full' : 'translate-y-0'
      } ${
        scrolled
          ? 'shadow-lg shadow-black/5 bg-background/95 backdrop-blur-md border-b border-border/50'
          : 'bg-background/80 backdrop-blur-md border-b border-transparent'
      }`}
    >
      <div className="mx-auto max-w-7xl px-3 sm:px-4 lg:px-8">
        <div className="flex h-14 sm:h-16 items-center justify-between gap-3 sm:gap-4">
          {/* Logo */}
          <button
            aria-label="হোম পেজে যান"
            className="flex items-center gap-2 shrink-0 cursor-pointer min-h-[44px] min-w-[44px] justify-center -ml-1 sm:ml-0"
            onClick={() => navigate('home')}
          >
            {config?.logo ? (
              <Image src={config.logo} alt={siteName} width={36} height={36} className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg object-contain" />
            ) : (
              <div className="relative flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-gradient-to-br from-edu-primary to-edu-primary-dark text-white shadow-md">
                <GraduationCap className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            )}
            <span className="text-base sm:text-lg font-bold leading-tight text-foreground truncate max-w-[120px] sm:max-w-none">{siteName}</span>
          </button>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-0.5" aria-label="মূল নেভিগেশন">
            {navLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="w-16 h-9 rounded-lg bg-muted/50 animate-pulse" />
                ))
              : visibleNav.map((link) => {
                  const isLinkActive = isRouteActive(link.route, currentRoute)
                  return (
                    <button
                      key={link.id}
                      onClick={() => handleNavClick(link.route)}
                      className={`relative px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 min-h-[36px] ${
                        isLinkActive ? 'text-edu-primary bg-edu-primary/5' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                      }`}
                      aria-current={isLinkActive ? 'page' : undefined}
                    >
                      {link.label}
                      {isLinkActive && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-edu-primary rounded-full" />}
                    </button>
                  )
                })}
          </nav>

          {/* Search Bar - Desktop */}
          <div className="hidden md:flex items-center flex-1 max-w-sm mx-4">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="কোর্স, অধ্যায় খুঁজুন..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="pl-9 pr-4 h-9 bg-muted/50 border-transparent focus:border-edu-primary/30 focus:bg-background transition-all"
                aria-label="সার্চ করুন"
              />
            </div>
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Search Toggle - Mobile */}
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 active:bg-accent transition-colors"
              aria-label={searchOpen ? "সার্চ বন্ধ করুন" : "সার্চ খুলুন"}
              aria-expanded={searchOpen}
            >
              {searchOpen ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
            </button>

            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className="flex items-center justify-center w-10 h-10 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 active:bg-accent transition-colors"
              aria-label="থিম পরিবর্তন করুন"
            >
              {mounted ? (isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />) : <div className="w-5 h-5" />}
            </button>

            {/* Class Badge - Desktop */}
            {mounted && isAuthenticated && user && isClassBased && currentClassLabel && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="hidden sm:flex gap-1.5 h-9 text-xs border-edu-primary/20 text-edu-primary">
                    <GraduationCap className="w-3.5 h-3.5" />
                    {currentClassLabel}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">শ্রেণি পরিবর্তন</div>
                  {classOptions.map((opt) => (
                    <DropdownMenuItem
                      key={opt.value}
                      onClick={() => setPreference('CLASS_BASED', opt.value)}
                      className={classLevel === opt.value ? 'bg-edu-primary/10 text-edu-primary' : ''}
                    >
                      <GraduationCap className="mr-2 h-4 w-4" />
                      {opt.label}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setPreference('GLOBAL')}>
                    <BookOpen className="mr-2 h-4 w-4" />
                    সার্বজনীন
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Focus Mode Toggle */}
            {isAuthenticated && mounted && !focusActive && (
              <button
                onClick={enterFocusMode}
                className="hidden sm:flex items-center justify-center w-10 h-10 rounded-lg text-muted-foreground hover:text-edu-primary hover:bg-edu-primary/10 active:bg-edu-primary/20 transition-colors"
                aria-label="ফোকাস মোড"
                title="ফোকাস মোড"
              >
                <Target className="w-5 h-5" />
              </button>
            )}

            {/* Notification Bell */}
            {isAuthenticated && mounted && <NotificationBell />}

            {/* User Menu / Login */}
            {!mounted ? (
              <div className="w-10 h-10 rounded-full bg-muted/50 animate-pulse hidden sm:block" />
            ) : isAuthenticated && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="relative flex items-center justify-center w-10 h-10 rounded-full" aria-label="ব্যবহারকারী মেনু">
                    <Avatar className="h-8 w-8 border-2 border-transparent hover:border-edu-primary/50 transition-colors">
                      <AvatarImage src={user.avatar} alt={user.name} />
                      <AvatarFallback className="bg-edu-primary/10 text-edu-primary text-xs font-semibold">
                        {getUserInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                    {user.isPremium && (
                      <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-edu-premium rounded-full border-2 border-background" />
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="flex items-center gap-2 p-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.avatar} alt={user.name} />
                      <AvatarFallback className="bg-edu-primary/10 text-edu-primary text-xs">{getUserInitials(user.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium truncate">{user.name}</span>
                      <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('user-dashboard')}>
                    <User className="mr-2 h-4 w-4" /> প্রোফাইল
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('premium')}>
                    <Crown className="mr-2 h-4 w-4 text-edu-premium" /> প্রিমিয়াম
                    {user.isPremium && <Badge className="ml-auto bg-edu-premium/10 text-edu-premium border-0 text-[10px] px-1.5">সক্রিয়</Badge>}
                  </DropdownMenuItem>
                  {isAdmin && (
                    <DropdownMenuItem onClick={() => navigate('admin-dashboard')}>
                      <LayoutDashboard className="mr-2 h-4 w-4" /> এডমিন প্যানেল
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" /> লগ আউট
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                onClick={() => navigate('login')}
                className="hidden sm:flex bg-edu-primary hover:bg-edu-primary-dark text-white gap-1.5"
                size="sm"
              >
                <LogIn className="w-4 h-4" /> লগইন
              </Button>
            )}

            {/* Mobile Menu */}
            <Sheet>
              <SheetTrigger asChild>
                <button
                  className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 active:bg-accent transition-colors"
                  aria-label="মেনু খুলুন"
                >
                  <Menu className="w-5 h-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72 p-0">
                <SheetHeader className="px-4 pt-5 pb-3 border-b border-border/50">
                  <SheetTitle className="flex items-center gap-2.5">
                    {config?.logo ? (
                      <Image src={config.logo} alt={siteName} width={32} height={32} className="w-8 h-8 rounded-lg object-contain" />
                    ) : (
                      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-edu-primary to-edu-primary-dark text-white">
                        <GraduationCap className="w-4 h-4" />
                      </div>
                    )}
                    {siteName}
                  </SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col gap-0.5 px-3 py-3" aria-label="মোবাইল নেভিগেশন">
                  {navLoading
                    ? Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
                          <div className="w-5 h-5 rounded bg-muted/50 animate-pulse" />
                          <div className="w-24 h-4 rounded bg-muted/50 animate-pulse" />
                        </div>
                      ))
                    : visibleNav.map((link) => {
                        const isLinkActive = isRouteActive(link.route, currentRoute)
                        return (
                          <SheetClose asChild key={link.id}>
                            <button
                              onClick={() => handleNavClick(link.route)}
                              className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200 min-h-[48px] ${
                                isLinkActive
                                  ? 'bg-edu-primary/10 text-edu-primary'
                                  : 'text-muted-foreground hover:bg-accent hover:text-foreground active:bg-accent/80'
                              }`}
                            >
                              <link.Icon className="w-5 h-5 shrink-0" />
                              {link.label}
                            </button>
                          </SheetClose>
                        )
                      })}
                </nav>

                {/* Mobile class changer */}
                {mounted && isAuthenticated && user && isClassBased && (
                  <div className="px-4 py-3 border-t border-border/50">
                    <p className="text-xs text-muted-foreground mb-2">আপনার শ্রেণি</p>
                    <div className="flex flex-wrap gap-1.5">
                      {classOptions.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setPreference('CLASS_BASED', opt.value)}
                          className={`text-xs px-2.5 py-1.5 rounded-full transition-colors min-h-[32px] ${
                            classLevel === opt.value
                              ? 'bg-edu-primary text-white'
                              : 'bg-muted text-muted-foreground hover:bg-accent'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                      <button
                        onClick={() => setPreference('GLOBAL')}
                        className={`text-xs px-2.5 py-1.5 rounded-full transition-colors min-h-[32px] ${
                          !isClassBased
                            ? 'bg-edu-primary text-white'
                            : 'bg-muted text-muted-foreground hover:bg-accent'
                        }`}
                      >
                        সার্বজনীন
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-auto px-4 pb-5 pt-3 border-t border-border/50">
                  {!mounted ? null : isAuthenticated && user ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-muted/50">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={user.avatar} alt={user.name} />
                          <AvatarFallback className="bg-edu-primary/10 text-edu-primary text-xs">{getUserInitials(user.name)}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-medium truncate">{user.name}</span>
                          <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                        </div>
                      </div>
                      <SheetClose asChild>
                        <Button variant="outline" className="w-full justify-start gap-2 text-destructive hover:text-destructive min-h-[44px]" onClick={handleLogout}>
                          <LogOut className="w-4 h-4" /> লগ আউট
                        </Button>
                      </SheetClose>
                    </div>
                  ) : (
                    <SheetClose asChild>
                      <Button className="w-full bg-edu-primary hover:bg-edu-primary-dark text-white gap-2 min-h-[44px]" onClick={() => navigate('login')}>
                        <LogIn className="w-4 h-4" /> লগইন করুন
                      </Button>
                    </SheetClose>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Mobile Search Bar */}
        {searchOpen && (
          <div className="md:hidden pb-3 animate-slide-up" style={{ animationDuration: '0.2s' }}>
            <div className="relative flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  ref={searchInputRef}
                  type="search"
                  placeholder="কোর্স, অধ্যায় খুঁজুন..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  className="w-full h-11 pl-10 pr-4 rounded-xl bg-muted/50 border border-transparent focus:border-edu-primary/30 focus:bg-background text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-all"
                  aria-label="সার্চ করুন"
                />
              </div>
              {searchQuery.trim() && (
                <button
                  onClick={handleSearch}
                  className="shrink-0 flex items-center justify-center h-11 px-4 rounded-xl bg-edu-primary text-white text-sm font-medium active:bg-edu-primary-dark transition-colors"
                  aria-label="সার্চ করুন"
                >
                  <Search className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
