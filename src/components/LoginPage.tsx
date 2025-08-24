import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { BookOpen, Heart, Star, AlertCircle, User, Sprout } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { UsernameService } from "@/lib/services/username";
import { AuthService } from "@/lib/services/auth";
import { LanguageSelector } from "@/components/LanguageSelector";

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



  return (
    <div className="min-h-screen bg-gradient-to-br from-green-100 via-green-50 to-amber-50">
      {/* Header */}
      <div className="bg-amber-50 border-b border-amber-200 shadow-sm">
        <div className="px-2 py-3 ml-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1">
                <div className="relative">
                  <Sprout className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" />
                  <Heart className="h-2 w-2 sm:h-3 sm:w-3 text-green-500 absolute -top-0.5 -right-0.5" />
                </div>
                <Star className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 animate-pulse" />
              </div>
              <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-green-600 to-green-800 bg-clip-text text-transparent">
                Grow
              </h1>
            </div>
            <LanguageSelector />
          </div>
          {/* <p className="text-sm text-amber-800 mt-1 ml-8 mb-2">
            Empowering parents in their child's learning journey
          </p> */}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex items-center justify-center p-3 sm:p-4 flex-1 mt-8">
        <div className="w-full max-w-sm sm:max-w-md space-y-4 sm:space-y-6">
          {/* Login/Signup Form */}
          <Card className="border-2 shadow-lg">
            <CardHeader className="text-center pb-3 sm:pb-4">
              <CardTitle className="text-lg sm:text-xl text-foreground">
                {isSignUp ? "Create Account" : "Welcome Back!"}
              </CardTitle>
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
                      className={`h-10 sm:h-12 text-xs sm:text-sm ${
                        role === "parent" 
                          ? "bg-green-600 hover:bg-green-700 text-white" 
                          : "border-green-300 text-green-700 hover:bg-green-50"
                      }`}
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
                      className={`h-10 sm:h-12 text-xs sm:text-sm ${
                        role === "teacher" 
                          ? "bg-green-600 hover:bg-green-700 text-white" 
                          : "border-green-300 text-green-700 hover:bg-green-50"
                      }`}
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
                      className={`h-10 sm:h-12 text-xs sm:text-sm ${
                        role === "admin" 
                          ? "bg-green-600 hover:bg-green-700 text-white" 
                          : "border-green-300 text-green-700 hover:bg-green-50"
                      }`}
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
                  className="w-full h-10 sm:h-12 text-base sm:text-lg font-semibold bg-green-600 hover:bg-green-700 text-white"
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
                  className="text-sm text-green-700 hover:text-green-800"
                >
                  {isSignUp 
                    ? "Already have an account? Sign in" 
                    : "Don't have an account? Sign up"
                  }
                </Button>
              </div>

              {/* Permanent Login Notice */}
              <div className="mt-4 sm:mt-6 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center space-x-2 text-green-800">
                  <Star className="h-4 w-4" />
                  <span className="text-sm font-medium">Permanent Login</span>
                </div>
                <p className="text-xs text-green-700 mt-1">
                  Once you sign in, you'll stay logged in permanently. No need to remember passwords!
                </p>
              </div>
            
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};