import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { BookOpen, Heart, Star } from "lucide-react";

interface LoginPageProps {
  onLogin: (role: "parent" | "teacher") => void;
}

export const LoginPage = ({ onLogin }: LoginPageProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"parent" | "teacher">("parent");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // For demo purposes, we'll just check if fields are filled
    if (email && password) {
      onLogin(role);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo and branding */}
        <div className="text-center space-y-4">
          <div className="flex justify-center items-center space-x-2">
            <div className="relative">
              <BookOpen className="h-12 w-12 text-primary" />
              <Heart className="h-4 w-4 text-destructive absolute -top-1 -right-1" />
            </div>
            <Star className="h-8 w-8 text-warning animate-pulse" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Little Learners
            </h1>
            <p className="text-muted-foreground mt-2">
              Connecting families and teachers for kindergarten success
            </p>
          </div>
        </div>

        {/* Login Form */}
        <Card className="border-2 shadow-lg">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl text-foreground">Welcome Back!</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Role Selection */}
              <div className="space-y-2">
                <Label htmlFor="role">I am a:</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={role === "parent" ? "default" : "outline"}
                    onClick={() => setRole("parent")}
                    className="h-12"
                  >
                    👨‍👩‍👧‍👦 Parent
                  </Button>
                  <Button
                    type="button"
                    variant={role === "teacher" ? "default" : "outline"}
                    onClick={() => setRole("teacher")}
                    className="h-12"
                  >
                    👩‍🏫 Teacher
                  </Button>
                </div>
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12"
                />
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
                  className="h-12"
                />
              </div>

              {/* Login Button */}
              <Button type="submit" className="w-full h-12 text-lg font-semibold">
                Sign In ✨
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              Demo Login - Enter any email and password
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};