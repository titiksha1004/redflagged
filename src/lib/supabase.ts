import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "../types/supabase";
import { sendAnalysisEmail } from "./email";
import type { ClaudeMessage } from "./claude-main";

// Add missing types
export interface GroqCompatible {
  role: "system" | "user" | "assistant";
  content: string;
}

// Load Supabase credentials
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

// Export isConfigured check for reuse
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Initialize Supabase client with detailed options
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  global: {
    fetch: (...args) => fetch(...args)
  }
});

  // Auth debug wrapper
const originalSignUp = supabase.auth.signUp;
supabase.auth.signUp = async (...args) => {
        console.log("signUp called with:", JSON.stringify(args[0], (key, value) => 
    key === 'password' ? '***REDACTED***' : value
  ));
  try {
    const result = await originalSignUp.apply(supabase.auth, args);
    console.log("📤 signUp result:", result.error ? `Error: ${result.error.message}` : "Success", 
      result.error ? { code: result.error.code, status: result.error.status } : {});
    return result;
  } catch (error) {
    console.error("❌ signUp exception:", error);
    throw error;
  }
};

const originalSignIn = supabase.auth.signInWithPassword;
supabase.auth.signInWithPassword = async (...args) => {
      console.log("signInWithPassword called with:", JSON.stringify(args[0], (key, value) => 
    key === 'password' ? '***REDACTED***' : value
  ));
  try {
    const result = await originalSignIn.apply(supabase.auth, args);
    console.log("📤 signInWithPassword result:", result.error ? `Error: ${result.error.message}` : "Success",
      result.error ? { code: result.error.code, status: result.error.status } : {});
    
    // Check for the specific database schema error
    if (result.error && result.error.message.includes('Database error querying schema')) {
      console.error('❌ Supabase auth database schema error detected. This likely indicates:');
      console.error('1. The auth schema in the Supabase project is misconfigured');
      console.error('2. The API key may not have sufficient permissions');
      console.error('3. The Supabase project may be in an error state');
      console.error('Please verify your Supabase project settings and ensure the auth tables are properly configured.');
    }
    
    return result;
  } catch (error) {
    console.error("❌ signInWithPassword exception:", error);
    throw error;
  }
};

// Test Supabase connection on initialization (only if configured)
if (isSupabaseConfigured) {
  // Silent connection test
  Promise.resolve(
    supabase
      .from("user_profiles")
      .select("count")
      .limit(1)
  ).catch(() => {
    // Silent fail - connection will be retried on actual use
  });
}

/** 🔹 Get current user (Helper) */
async function getUser() {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase not configured");
  }

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) throw new Error("🔑 User not authenticated");
  return data.user;
}

/** 🔹 Interfaces */
export type Contract = Database["public"]["Tables"]["contracts"]["Row"];
export type AnalysisResult =
  Database["public"]["Tables"]["analysis_results"]["Row"];
export type AnalysisIssue =
  Database["public"]["Tables"]["analysis_issues"]["Row"];
export type UserSettings = Database["public"]["Tables"]["user_settings"]["Row"];
export type ConversationHistory =
  Database["public"]["Tables"]["conversation_history"]["Row"];
export type UserProfile = Database["public"]["Tables"]["user_profiles"]["Row"];

/** 🔹 Save a conversation */
export async function saveConversation(title: string, messages: ClaudeMessage[]) {
  const user = await supabase.auth.getUser();
  if (!user.data.user) {
    throw new Error("Not authenticated");
  }

  const { error } = await supabase.from("conversation_history").insert({
    user_id: user.data.user.id,
    title,
    messages: messages as unknown as Json[],
  });

  if (error) throw error;
}

/** 🔹 Get recent conversations */
export async function getRecentConversations(limit = 5) {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase not configured");
  }

  try {
    const user = await getUser();
    const { data, error } = await supabase
      .from("conversation_history")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  } catch (error) {
          console.error("Error getting recent conversations:", error);
    throw error;
  }
}

/** 🔹 Analyze a contract */
export async function analyzeContract(content: string, url?: string) {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase not configured");
  }

  try {
    const user = await getUser();

    // Insert contract record
    const { data: contract, error } = await supabase
      .from("contracts")
      .insert({
        content,
        title: url ? new URL(url).hostname : "Manual Analysis",
        user_id: user.id,
        url: url || null,
      })
      .select()
      .single();

    if (error) throw error;

    // For now, we'll use placeholder analysis data
    // In a real implementation, this would come from your AI analysis
    const analysis = { risk_level: "medium" as const };

    // Get user settings
    const { data: settings, error: settingsError } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (settingsError) {
              console.warn("No user settings found. Creating defaults.");
      // Create default settings if none exist
      const defaultSettings = {
        user_id: user.id,
        email_notifications: true,
        notification_frequency: "instant",
        theme: "light",
        language: "en",
      };

      await updateUserSettings(defaultSettings);
    }

    // Placeholder for issues (would come from AI analysis)
    const issues: Partial<AnalysisIssue>[] = [];

    // Insert analysis result
    const { error: analysisError } = await supabase
      .from("analysis_results")
      .insert({
        contract_id: contract.id,
        user_id: user.id,
        risk_level: analysis.risk_level,
        summary: "Analysis completed",
      });

    if (analysisError) throw analysisError;

    // Send email notification if enabled
    if (settings?.email_notifications) {
      if (user.email) {
        try {
          await sendAnalysisEmail(user.email, {
            userName: user.email.split("@")[0],
            contractTitle: contract.title,
            riskLevel: analysis.risk_level,
            issuesCount: issues.length,
          });
        } catch (emailError) {
          console.error("Error sending email notification:", emailError);
          // Don't throw here, just log the error
        }
      }
    }

    return {
      contract,
      analysis,
      issues,
      emailNotifications: settings?.email_notifications || false,
      notificationFrequency: settings?.notification_frequency || "instant",
    };
  } catch (error) {
    console.error("Error analyzing contract:", error);
    throw error;
  }
}

/** 🔹 Get user settings */
export async function getUserSettings() {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase not configured");
  }

  try {
    const user = await getUser();

    const { data, error } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (error) {
      // If no settings found, create default settings
      if (error.code === "PGRST116") {
        // No rows returned
        const defaultSettings = {
          user_id: user.id,
          email_notifications: true,
          notification_frequency: "instant",
          theme: "light",
          language: "en",
        };

        return updateUserSettings(defaultSettings);
      }
      throw error;
    }

    return data;
  } catch (error) {
    console.error("Error fetching user settings:", error);
    throw error;
  }
}

/** 🔹 Update user settings */
/** 🔹 Update user settings */
export async function updateUserSettings(settingsData: Partial<UserSettings>) {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase not configured");
  }

  try {
    const user = await getUser();

    // Create settings object with required user_id
    // Type assertion for user_id
    const settings = {
      user_id: user.id,
      ...(settingsData as Partial<Omit<UserSettings, "user_id">>),
    } as { user_id: string } & Partial<UserSettings>;

    // Handle both camelCase and snake_case input keys
    // This is a safety measure if your frontend still passes camelCase
    if ("emailNotifications" in settingsData) {
      settings.email_notifications = settingsData.emailNotifications as boolean;
    }

    if ("notificationFrequency" in settingsData) {
      settings.notification_frequency =
        settingsData.notificationFrequency as string;
    }

    // Check if settings already exist
    const { data: existingSettings, error: checkError } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (checkError && checkError.code !== "PGRST116") throw checkError;

    let data;

    if (existingSettings) {
      // Update existing settings
      const { data: updateData, error: updateError } = await supabase
        .from("user_settings")
        .update(settings)
        .eq("user_id", user.id)
        .select()
        .single();

      if (updateError) throw updateError;
      data = updateData;
    } else {
      // Set required fields for new settings if not already set
      if (!settings.email_notifications) settings.email_notifications = true;
      if (!settings.notification_frequency)
        settings.notification_frequency = "daily";
      if (!settings.theme) settings.theme = "light";
      if (!settings.language) settings.language = "en";

      // Insert new settings
      const { data: insertData, error: insertError } = await supabase
        .from("user_settings")
        .insert(settings)
        .select()
        .single();

      if (insertError) throw insertError;
      data = insertData;
    }

    return data;
  } catch (error) {
    console.error("Error updating user settings:", error);
    throw error;
  }
}

/** 🔹 Get user profile */
export async function getUserProfile() {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase not configured");
  }

  try {
    const user = await getUser();

    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error fetching user profile:", error);
    throw error;
  }
}

/** 🔹 Update user profile */
export async function updateUserProfile(profile: Partial<UserProfile>) {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase not configured");
  }

  try {
    const user = await getUser();

    const { data, error } = await supabase
      .from("user_profiles")
      .update(profile)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error updating user profile:", error);
    throw error;
  }
}

/** 🔹 Get notifications */
export async function getNotifications() {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase not configured");
  }

  try {
    const user = await getUser();

    const { data, error } = await supabase
      .from("user_notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error fetching notifications:", error);
    throw error;
  }
}

/** 🔹 Mark notification as read */
export async function markNotificationAsRead(id: string) {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase not configured");
  }

  try {
    const { error } = await supabase
      .from("user_notifications")
      .update({ read: true })
      .eq("id", id);

    if (error) throw error;
    return { message: "Notification marked as read" };
  } catch (error) {
          console.error("Error marking notification as read:", error);
    throw error;
  }
}
