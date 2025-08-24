import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Smartphone, 
  Tablet, 
  Monitor, 
  CheckCircle, 
  Star, 
  Heart, 
  Users, 
  BookOpen,
  Bell,
  TrendingUp
} from 'lucide-react';

export const MobileResponsiveDemo = () => {
  return (
    <div className="mobile-container space-y-6">
      {/* Responsive Header */}
      <div className="text-center mobile-space-y">
        <h1 className="text-responsive-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Mobile-First Responsive Design
        </h1>
        <p className="text-responsive-base text-muted-foreground max-w-2xl mx-auto">
          This component demonstrates all the mobile-responsive utilities and patterns implemented in KindyReach.
          Resize your browser window to see the responsive behavior in action.
        </p>
      </div>

      {/* Responsive Grid System */}
      <Card>
        <CardHeader className="mobile-card">
          <CardTitle className="text-responsive-lg flex items-center gap-2">
            <CheckCircle className="mobile-icon text-success" />
            Responsive Grid System
          </CardTitle>
        </CardHeader>
        <CardContent className="mobile-card pt-0">
          <div className="mobile-card-grid">
            <Card className="mobile-card">
              <CardContent className="text-center">
                <Smartphone className="mobile-icon-lg mx-auto mb-2 text-primary" />
                <h3 className="text-responsive-base font-semibold mb-1">Mobile First</h3>
                <p className="text-responsive-xs text-muted-foreground">Starts with mobile layout</p>
              </CardContent>
            </Card>
            
            <Card className="mobile-card">
              <CardContent className="text-center">
                <Tablet className="mobile-icon-lg mx-auto mb-2 text-secondary" />
                <h3 className="text-responsive-base font-semibold mb-1">Tablet Ready</h3>
                <p className="text-responsive-xs text-muted-foreground">Optimized for medium screens</p>
              </CardContent>
            </Card>
            
            <Card className="mobile-card">
              <CardContent className="text-center">
                <Monitor className="mobile-icon-lg mx-auto mb-2 text-accent" />
                <h3 className="text-responsive-base font-semibold mb-1">Desktop Enhanced</h3>
                <p className="text-responsive-xs text-muted-foreground">Full features on large screens</p>
              </CardContent>
            </Card>
            
            <Card className="mobile-card">
              <CardContent className="text-center">
                <Star className="mobile-icon-lg mx-auto mb-2 text-warning" />
                <h3 className="text-responsive-base font-semibold mb-1">Adaptive UI</h3>
                <p className="text-responsive-xs text-muted-foreground">Smart component scaling</p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Responsive Typography */}
      <Card>
        <CardHeader className="mobile-card">
          <CardTitle className="text-responsive-lg flex items-center gap-2">
            <BookOpen className="mobile-icon text-primary" />
            Responsive Typography
          </CardTitle>
        </CardHeader>
        <CardContent className="mobile-card pt-0">
          <div className="mobile-space-y">
            <div>
              <h1 className="text-responsive-2xl font-bold">Heading 2XL - Responsive</h1>
              <p className="text-responsive-xs text-muted-foreground">Starts small on mobile, scales up on larger screens</p>
            </div>
            
            <div>
              <h2 className="text-responsive-xl font-semibold">Heading XL - Responsive</h2>
              <p className="text-responsive-xs text-muted-foreground">Adaptive sizing for optimal readability</p>
            </div>
            
            <div>
              <h3 className="text-responsive-lg font-medium">Heading LG - Responsive</h3>
              <p className="text-responsive-xs text-muted-foreground">Consistent hierarchy across devices</p>
            </div>
            
            <div>
              <p className="text-responsive-base">Base text that scales appropriately</p>
              <p className="text-responsive-sm text-muted-foreground">Smaller text for secondary information</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Responsive Spacing & Layout */}
      <Card>
        <CardHeader className="mobile-card">
          <CardTitle className="text-responsive-lg flex items-center gap-2">
            <TrendingUp className="mobile-icon text-accent" />
            Responsive Spacing & Layout
          </CardTitle>
        </CardHeader>
        <CardContent className="mobile-card pt-0">
          <div className="mobile-space-y">
            <div className="mobile-flex-between">
              <div>
                <h4 className="text-responsive-base font-medium mb-2">Flexible Layouts</h4>
                <p className="text-responsive-sm text-muted-foreground">
                  Layouts that adapt from column to row based on screen size
                </p>
              </div>
              <div className="mobile-button-group">
                <Button size="sm" variant="outline">Action 1</Button>
                <Button size="sm" variant="outline">Action 2</Button>
              </div>
            </div>
            
            <div className="mobile-flex-wrap">
              <Badge variant="secondary" className="mobile-badge">Responsive</Badge>
              <Badge variant="secondary" className="mobile-badge">Mobile</Badge>
              <Badge variant="secondary" className="mobile-badge">First</Badge>
              <Badge variant="secondary" className="mobile-badge">Design</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Responsive Forms */}
      <Card>
        <CardHeader className="mobile-card">
          <CardTitle className="text-responsive-lg flex items-center gap-2">
            <Users className="mobile-icon text-success" />
            Responsive Forms
          </CardTitle>
        </CardHeader>
        <CardContent className="mobile-card pt-0">
          <div className="mobile-space-y">
            <div className="mobile-card-grid">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" placeholder="Enter your name" className="mobile-input" />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="Enter your email" className="mobile-input" />
              </div>
            </div>
            
            <div className="mobile-button-stack">
              <Button className="touch-button w-full">Submit Form</Button>
              <Button variant="outline" className="touch-button w-full">Cancel</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Responsive Cards & Content */}
      <Card>
        <CardHeader className="mobile-card">
          <CardTitle className="text-responsive-lg flex items-center gap-2">
            <Heart className="mobile-icon text-destructive" />
            Responsive Cards & Content
          </CardTitle>
        </CardHeader>
        <CardContent className="mobile-card pt-0">
          <div className="mobile-card-stack">
            <Card className="mobile-card">
              <CardContent className="text-center">
                <Bell className="mobile-icon-md mx-auto mb-3 text-warning" />
                <h4 className="text-responsive-base font-medium mb-2">Notification Center</h4>
                <p className="text-responsive-sm text-muted-foreground">
                  Responsive notifications that work on all devices
                </p>
              </CardContent>
            </Card>
            
            <Card className="mobile-card">
              <CardContent className="text-center">
                <BookOpen className="mobile-icon-md mx-auto mb-3 text-primary" />
                <h4 className="text-responsive-base font-medium mb-2">Learning Resources</h4>
                <p className="text-responsive-sm text-muted-foreground">
                  Educational content optimized for every screen size
                </p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Responsive Utilities Showcase */}
      <Card>
        <CardHeader className="mobile-card">
          <CardTitle className="text-responsive-lg flex items-center gap-2">
            <Star className="mobile-icon text-warning" />
            Responsive Utilities Showcase
          </CardTitle>
        </CardHeader>
        <CardContent className="mobile-card pt-0">
          <div className="mobile-space-y">
            <div className="mobile-flex-center">
              <div className="text-center">
                <div className="mobile-image-md mx-auto mb-3 bg-primary/10 rounded-full flex items-center justify-center">
                  <CheckCircle className="mobile-icon text-primary" />
                </div>
                <h4 className="text-responsive-base font-medium">Utility Classes</h4>
                <p className="text-responsive-sm text-muted-foreground">
                  Pre-built responsive utility classes for common patterns
                </p>
              </div>
            </div>
            
            <div className="mobile-overflow">
              <div className="flex space-x-4 overflow-x-auto pb-2">
                <Badge className="mobile-badge whitespace-nowrap">mobile-container</Badge>
                <Badge className="mobile-badge whitespace-nowrap">mobile-card</Badge>
                <Badge className="mobile-badge whitespace-nowrap">mobile-text</Badge>
                <Badge className="mobile-badge whitespace-nowrap">mobile-grid</Badge>
                <Badge className="mobile-badge whitespace-nowrap">mobile-space-y</Badge>
                <Badge className="mobile-badge whitespace-nowrap">touch-button</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Responsive Breakpoint Indicator */}
      <Card className="mobile-card">
        <CardContent className="text-center">
          <div className="mobile-space-y">
            <h3 className="text-responsive-lg font-semibold">Current Breakpoint</h3>
            <div className="mobile-flex-center gap-2">
              <div className="mobile-only">
                <Badge variant="secondary" className="mobile-badge">
                  <Smartphone className="mobile-icon-sm mr-1" />
                  Mobile (≤640px)
                </Badge>
              </div>
              <div className="hidden sm:block md:hidden">
                <Badge variant="secondary" className="mobile-badge">
                  <Tablet className="mobile-icon-sm mr-1" />
                  Small (640px+)
                </Badge>
              </div>
              <div className="hidden md:block lg:hidden">
                <Badge variant="secondary" className="mobile-badge">
                  <Tablet className="mobile-icon-sm mr-1" />
                  Medium (768px+)
                </Badge>
              </div>
              <div className="hidden lg:block xl:hidden">
                <Badge variant="secondary" className="mobile-badge">
                  <Monitor className="mobile-icon-sm mr-1" />
                  Large (1024px+)
                </Badge>
              </div>
              <div className="hidden xl:block">
                <Badge variant="secondary" className="mobile-badge">
                  <Monitor className="mobile-icon-sm mr-1" />
                  XL (1280px+)
                </Badge>
              </div>
            </div>
            <p className="text-responsive-sm text-muted-foreground">
              Resize your browser window to see the responsive behavior
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
