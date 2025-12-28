import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { MainLayout } from "@/components/ui/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <MainLayout>
      <div className="min-h-[60vh] w-full flex items-center justify-center bg-gray-50 py-12">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6 pb-6">
            <div className="flex flex-col items-center text-center">
              <div className="rounded-full bg-red-100 p-3 mb-4">
                <AlertCircle className="h-8 w-8 text-red-500" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">404 Page Not Found</h1>
              <p className="mb-6 text-gray-600">
                The page you are looking for doesn't exist or has been moved.
              </p>
              
              <Link href="/">
                <Button className="bg-primary hover:bg-blue-700 text-white">
                  Return to Home
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
