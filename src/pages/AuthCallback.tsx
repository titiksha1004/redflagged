import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { toast } from "sonner";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Handle the OAuth callback
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error("Error getting session:", error.message);
          toast.error(`Authentication failed: ${error.message}`);
          navigate("/signin");
          return;
        }

        if (data?.session) {
          console.log("Authentication successful:", data.session.user);
          toast.success("Successfully signed in!");
          navigate("/get-started");
        } else {
          // Try to get the URL hash parameters for OAuth callback
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const accessToken = hashParams.get('access_token');
          const errorParam = hashParams.get('error');
          
          if (errorParam) {
            console.error("OAuth error:", errorParam);
            toast.error(`OAuth error: ${errorParam}`);
            navigate("/signin");
            return;
          }

          if (accessToken) {
            // Try to set the session with the access token
            const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: hashParams.get('refresh_token') || ''
            });

            if (sessionError) {
              console.error("Error setting session:", sessionError.message);
              toast.error(`Session error: ${sessionError.message}`);
              navigate("/signin");
              return;
            }

            if (sessionData?.session) {
              console.log("Session set successfully:", sessionData.session.user);
              toast.success("Successfully signed in!");
              navigate("/get-started");
              return;
            }
          }

          // No session found, redirect to signin
          console.error("No session found after OAuth callback");
          toast.error("No session found. Please try signing in again.");
          navigate("/signin");
        }
      } catch (error: any) {
        console.error("Unexpected error during auth callback:", error);
        toast.error("An unexpected error occurred. Please try again.");
        navigate("/signin");
      } finally {
        setIsProcessing(false);
      }
    };

    handleAuthCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen pt-20 flex justify-center items-center bg-gradient-to-b from-white to-indigo-50">
      <div className="text-center">
        {isProcessing ? (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-lg text-gray-600">
              Completing authentication...
            </p>
          </>
        ) : (
          <>
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <p className="text-lg text-gray-600">
              Authentication failed. Redirecting...
            </p>
          </>
        )}
      </div>
    </div>
  );
}
