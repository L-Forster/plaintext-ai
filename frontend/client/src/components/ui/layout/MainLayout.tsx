import { ReactNode } from 'react';
import { useLocation, Link } from 'wouter';
import {
  PanelRightOpen,
  Search
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { ThemeToggle } from '@/components/ThemeToggle';
import { 
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuLink
} from '@/components/ui/navigation-menu';

interface MainLayoutProps {
  children: ReactNode;
  fullWidth?: boolean;
}

export function MainLayout({ children, fullWidth = false }: MainLayoutProps) {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isMobile = useIsMobile();
  
  // Close mobile menu when location changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  return (
    <div className="flex flex-col min-h-screen bg-theme-background text-theme-foreground">

      
      {/* Navigation header with theme-aware styling */}
      {/* Changed 'sticky' to 'fixed' and added 'left-0 right-0' for full width */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-theme-border bg-theme-card/80 backdrop-blur-sm">
        <NavigationMenu className="w-full">
          {/* This div will center your content within the fixed header */}
          <div className="w-full max-w-[1920px] mx-auto px-4 py-3 flex justify-between items-center">
            {/* Logo */}
            <Link href="/research" className="flex items-center cursor-pointer">
              <span className="text-xl font-semibold text-theme-secondary font-serif">
                Plaintext AI
              </span>
            </Link>

            {/* Navigation Items */}
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuLink
                  className={`text-sm flex items-center hover:text-primary cursor-pointer ${location === '/workflow' ? 'text-primary font-medium' : 'text-theme-muted-foreground'}`}
                  href="/workflow"
                >
                  <PanelRightOpen className="mr-2 h-5 w-5" />
                  Research Workflow
                </NavigationMenuLink>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <NavigationMenuLink
                  className={`text-sm flex items-center hover:text-primary cursor-pointer ${location === '/research' ? 'text-primary font-medium' : 'text-theme-muted-foreground'}`}
                  href="/research"
                >
                  <Search className="mr-2 h-5 w-5" />
                  Research Agent
                </NavigationMenuLink>
              </NavigationMenuItem>
            </NavigationMenuList>

            {/* Theme toggle */}
            <div className="flex items-center space-x-4">
              <ThemeToggle />
            </div>
          </div>
        </NavigationMenu>

        {/* Mobile Navigation Menu - Only show when mobile menu is open */}
        {isMobile && mobileMenuOpen && (
          <div className="lg:hidden fixed top-16 left-0 right-0 border-b border-theme-border bg-theme-card w-full z-40">
            <nav className="w-full max-w-[1920px] mx-auto px-4 py-2 flex flex-col">
              <Link href="/workflow" className={`py-2 text-sm flex items-center hover:text-primary cursor-pointer ${location === '/workflow' ? 'text-primary font-medium' : 'text-theme-muted-foreground'}`}>
                <PanelRightOpen className="mr-2 h-5 w-5" />
                Research Workflow
              </Link>
              <Link href="/research" className={`py-2 text-sm flex items-center hover:text-primary cursor-pointer ${location === '/research' ? 'text-primary font-medium' : 'text-theme-muted-foreground'}`}>
                <Search className="mr-2 h-5 w-5" />
                Research Agent
              </Link>
            </nav>
          </div>
        )}
      </header>

      {/* Adjusted top padding: pt-20 (80px) as a test, can be fine-tuned */}
      <main className={`flex-1 bg-theme-background pt-20 ${location === '/scholar' ? 'md:pt-28' : ''}`}>
        <div className={`w-full ${fullWidth ? '' : 'max-w-[1920px] mx-auto px-4'}`}>
          {children}
        </div>
      </main>

      {/* Footer removed for self-hosted version */}
    </div>
  );
}