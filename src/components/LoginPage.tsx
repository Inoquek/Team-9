import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { BookOpen, Heart, Star, AlertCircle, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { UsernameService } from "@/lib/services/username";
import { AuthService } from "@/lib/services/auth";

export const LoginPage = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"parent" | "teacher" | "admin">("parent");
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [usernameError, setUsernameError] = useState("");
  
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();

  // Validate username in real-time
  const handleUsernameChange = async (value: string) => {
    setUsername(value);
    setUsernameError("");

    if (value.length >= 3) {
      const validation = UsernameService.validateUsername(value);
      if (!validation.isValid) {
        setUsernameError(validation.message || "Invalid username");
        return;
      }

      if (isSignUp) {
        const isAvailable = await UsernameService.isUsernameAvailable(value);
        if (!isAvailable) {
          setUsernameError("Username is already taken");
        }
      }
    }
  };

  // Simplify the handleSubmit function:
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Client-side validation
    const errors = [];
    
    if (!username || username.trim() === '') {
      errors.push('Username is required');
    }
    
    if (!password || password.trim() === '') {
      errors.push('Password is required');
    }
    
    if (isSignUp && (!displayName || displayName.trim() === '')) {
      errors.push('Display name is required');
    }

    if (errors.length > 0) {
      toast({
        title: "Missing Information",
        description: errors.join(', '),
        variant: "destructive"
      });
      return;
    }

    if (usernameError) {
      toast({
        title: "Invalid Username",
        description: usernameError,
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    
    try {
      if (isSignUp) {
        await signUp(username.trim(), password, { 
          role, 
          displayName: displayName.trim()
          // Only pass essential fields
        });
        toast({
          title: "Account Created!",
          description: "Welcome to KindyReach! You'll stay logged in forever.",
        });
      } else {
        await signIn(username.trim(), password);
        toast({
          title: "Welcome Back!",
          description: "You're now logged in permanently.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Authentication Error",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createFirstAdmin = async () => {
    try {
      await signUp("admin", "admin123", { 
        role: "admin", 
        displayName: "System Administrator" 
      });
      toast({
        title: "Admin Created!",
        description: "First admin account created successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create admin account.",
        variant: "destructive"
      });
    }
  };

  const testUsernameLookup = async () => {
    try {
      const uid = await UsernameService.getUserByUsername("admin");
      console.log("Username lookup result:", uid);
      
      if (uid) {
        // Test getting user data
        const userData = await AuthService.getUserData(uid);
        console.log("User data:", userData);
      }
    } catch (error) {
      console.error("Username lookup error:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20 flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-sm sm:max-w-md space-y-4 sm:space-y-6">
        {/* Logo and branding */}
        <div className="text-center space-y-3 sm:space-y-4">
          <div className="flex justify-center items-center space-x-2">
            <div className="relative">
              <BookOpen className="h-10 w-10 sm:h-12 sm:w-12 text-primary" />
              <Heart className="h-3 w-3 sm:h-4 sm:w-4 text-destructive absolute -top-1 -right-1" />
            </div>
            <Star className="h-6 w-6 sm:h-8 sm:w-8 text-warning animate-pulse" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              KindyReach
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-2">
              Empowering parents in their child's learning journey
            </p>
          </div>
        </div>

        {/* Login/Signup Form */}
        <Card className="border-2 shadow-lg">
          <CardHeader className="text-center pb-3 sm:pb-4">
            <CardTitle className="text-lg sm:text-xl text-foreground">
              {isSignUp ? "Create Account" : "Welcome Back!"}
            </CardTitle>
            <p className="text-xs sm:text-sm text-muted-foreground mt-2">
              {isSignUp 
                ? "Create your account once, stay logged in forever!" 
                : "You'll stay logged in permanently"
              }
            </p>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pb-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Role Selection */}
              <div className="space-y-2">
                <Label htmlFor="role">I am a:</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant={role === "parent" ? "default" : "outline"}
                    onClick={() => setRole("parent")}
                    className="h-10 sm:h-12 text-xs sm:text-sm"
                    disabled={isLoading}
                  >
                    <span className="hidden sm:inline">👨‍👩‍👧‍👦</span>
                    <span className="sm:hidden">👨‍👩‍👧‍👦</span>
                    <span className="hidden sm:inline"> Parent</span>
                    <span className="sm:hidden">P</span>
                  </Button>
                  <Button
                    type="button"
                    variant={role === "teacher" ? "default" : "outline"}
                    onClick={() => setRole("teacher")}
                    className="h-10 sm:h-12 text-xs sm:text-sm"
                    disabled={isLoading}
                  >
                    <span className="hidden sm:inline">👩‍🏫</span>
                    <span className="sm:hidden">👩‍🏫</span>
                    <span className="hidden sm:inline"> Teacher</span>
                    <span className="sm:hidden">T</span>
                  </Button>
                  <Button
                    type="button"
                    variant={role === "admin" ? "default" : "outline"}
                    onClick={() => setRole("admin")}
                    className="h-10 sm:h-12 text-xs sm:text-sm"
                    disabled={isLoading}
                  >
                    <span className="hidden sm:inline">👨‍💻</span>
                    <span className="sm:hidden">👨‍💻</span>
                    <span className="hidden sm:inline"> Admin</span>
                    <span className="sm:hidden">A</span>
                  </Button>
                </div>
              </div>

              {/* Display Name (Sign Up Only) */}
              {isSignUp && (
                <div className="space-y-2">
                  <Label htmlFor="displayName">Full Name</Label>
                  <Input
                    id="displayName"
                    type="text"
                    placeholder="Enter your full name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                    className="h-10 sm:h-12"
                    disabled={isLoading}
                  />
                </div>
              )}

              {/* Username */}
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="username"
                    type="text"
                    placeholder="Choose a username"
                    value={username}
                    onChange={(e) => handleUsernameChange(e.target.value)}
                    required
                    className="h-10 sm:h-12 pl-10"
                    disabled={isLoading}
                  />
                </div>
                {usernameError && (
                  <div className="flex items-center space-x-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <span>{usernameError}</span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Username must be 3-20 characters, letters, numbers, and underscores only
                </p>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-10 sm:h-12"
                  disabled={isLoading}
                />
              </div>

              {/* Submit Button */}
              <Button 
                type="submit" 
                className="w-full h-10 sm:h-12 text-base sm:text-lg font-semibold"
                disabled={isLoading || !!usernameError}
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Loading...</span>
                  </div>
                ) : (
                  <span>{isSignUp ? "Create Account ✨" : "Sign In ✨"}</span>
                )}
              </Button>
            </form>

            {/* Toggle Sign Up/Login */}
            <div className="mt-4 sm:mt-6 text-center">
              <Button
                variant="link"
                onClick={() => setIsSignUp(!isSignUp)}
                disabled={isLoading}
                className="text-sm"
              >
                {isSignUp 
                  ? "Already have an account? Sign in" 
                  : "Don't have an account? Sign up"
                }
              </Button>
            </div>

            {/* Permanent Login Notice */}
            <div className="mt-3 sm:mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center space-x-2 text-blue-800">
                <Star className="h-4 w-4" />
                <span className="text-sm font-medium">Permanent Login</span>
              </div>
              <p className="text-xs text-blue-700 mt-1">
                Once you sign in, you'll stay logged in forever. No need to remember passwords!
              </p>
            </div>

            {/* Temporary Admin Creation Button - REMOVE AFTER USE */}
            <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="text-center">
                <p className="text-xs sm:text-sm text-yellow-800 mb-3">
                  <strong>Development Only:</strong> Create first admin account
                </p>
                <Button
                  onClick={createFirstAdmin}
                  variant="outline"
                  className="w-full h-10"
                >
                  🛠️ Create First Admin Account
                </Button>
                <p className="text-xs text-yellow-600 mt-2">
                  Use this button to create the first admin, then remove it
                </p>
              </div>
            </div>

            <Button onClick={testUsernameLookup} variant="outline" className="mt-2 w-full h-10">
              🔍 Debug Username Lookup
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};