import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/auth";
import { api } from "@/lib/api";
import { useColors } from "@/hooks/useColors";

type Mode = "login" | "register";
type Step = "form" | "otp";

export default function AuthScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { login, register } = useAuth();

  const [mode, setMode] = useState<Mode>("login");
  const [step, setStep] = useState<Step>("form");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const switchMode = (m: Mode) => {
    setMode(m);
    setStep("form");
    setOtpCode("");
  };

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Required", "Please enter your email and password.");
      return;
    }
    if (mode === "register") {
      if (!fullName.trim()) { Alert.alert("Required", "Full name is required."); return; }
      if (password.length < 6) { Alert.alert("Password", "Password must be at least 6 characters."); return; }
      if (password !== confirmPassword) { Alert.alert("Password", "Passwords do not match."); return; }
    }

    setLoading(true);
    try {
      if (mode === "login") {
        const result = await login(email.trim().toLowerCase(), password, step === "otp" ? otpCode : undefined);
        if (result.otpRequired) {
          setStep("otp");
          return;
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace("/(tabs)");
      } else {
        await register({
          email: email.trim().toLowerCase(),
          password,
          fullName: fullName.trim(),
          referralCode: referralCode.trim() || undefined,
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace("/(tabs)");
      }
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpResend = async () => {
    try {
      await api.auth.sendEmailOtp(email.trim().toLowerCase(), "login");
      Alert.alert("Sent", "A new code was sent to your email.");
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to resend code.");
    }
  };

  const s = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scroll: {
      flexGrow: 1,
      justifyContent: "center",
      paddingHorizontal: 24,
      paddingTop: insets.top + 20,
      paddingBottom: insets.bottom + 24,
    },
    logoRow: {
      alignItems: "center",
      marginBottom: 12,
    },
    logo: {
      width: 72,
      height: 72,
      borderRadius: 16,
    },
    appName: {
      marginTop: 12,
      fontSize: 28,
      fontWeight: "700" as const,
      color: colors.primary,
      letterSpacing: 4,
      fontFamily: "Inter_700Bold",
    },
    tagline: {
      marginTop: 4,
      fontSize: 13,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
    },
    toggle: {
      flexDirection: "row",
      backgroundColor: colors.secondary,
      borderRadius: 12,
      padding: 4,
      marginBottom: 28,
      marginTop: 32,
    },
    toggleBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 9,
      alignItems: "center",
    },
    toggleBtnActive: {
      backgroundColor: colors.card,
    },
    toggleText: {
      fontSize: 14,
      fontFamily: "Inter_500Medium",
      color: colors.mutedForeground,
    },
    toggleTextActive: {
      color: colors.foreground,
    },
    label: {
      fontSize: 12,
      color: colors.mutedForeground,
      marginBottom: 6,
      marginTop: 14,
      fontFamily: "Inter_500Medium",
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.input,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      height: 50,
    },
    input: {
      flex: 1,
      color: colors.foreground,
      fontSize: 15,
      fontFamily: "Inter_400Regular",
    },
    primaryBtn: {
      backgroundColor: colors.primary,
      borderRadius: 14,
      height: 52,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 28,
    },
    primaryBtnText: {
      color: colors.primaryForeground,
      fontSize: 16,
      fontFamily: "Inter_600SemiBold",
    },
    otpInfo: {
      marginTop: 8,
      fontSize: 13,
      color: colors.mutedForeground,
      textAlign: "center",
      fontFamily: "Inter_400Regular",
    },
    resendBtn: {
      marginTop: 16,
      alignItems: "center",
    },
    resendText: {
      color: colors.primary,
      fontSize: 14,
      fontFamily: "Inter_500Medium",
    },
  });

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={s.logoRow}>
          <Image source={require("../../assets/images/icon.png")} style={s.logo} />
          <Text style={s.appName}>TELEVERSE</Text>
          <Text style={s.tagline}>Crypto Investment Platform</Text>
        </View>

        {step === "form" && (
          <>
            <View style={s.toggle}>
              {(["login", "register"] as Mode[]).map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[s.toggleBtn, mode === m && s.toggleBtnActive]}
                  onPress={() => switchMode(m)}
                >
                  <Text style={[s.toggleText, mode === m && s.toggleTextActive]}>
                    {m === "login" ? "Sign In" : "Create Account"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {mode === "register" && (
              <>
                <Text style={s.label}>Full Name</Text>
                <View style={s.inputRow}>
                  <TextInput
                    style={s.input}
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder="John Doe"
                    placeholderTextColor={colors.mutedForeground}
                    autoCapitalize="words"
                    autoCorrect={false}
                  />
                </View>
              </>
            )}

            <Text style={s.label}>Email</Text>
            <View style={s.inputRow}>
              <TextInput
                style={s.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <Text style={s.label}>Password</Text>
            <View style={s.inputRow}>
              <TextInput
                style={s.input}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <Pressable onPress={() => setShowPassword((v) => !v)}>
                <Feather name={showPassword ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
              </Pressable>
            </View>

            {mode === "register" && (
              <>
                <Text style={s.label}>Confirm Password</Text>
                <View style={s.inputRow}>
                  <TextInput
                    style={s.input}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="••••••••"
                    placeholderTextColor={colors.mutedForeground}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                </View>

                <Text style={s.label}>Referral Code (optional)</Text>
                <View style={s.inputRow}>
                  <TextInput
                    style={s.input}
                    value={referralCode}
                    onChangeText={setReferralCode}
                    placeholder="XXXXXX"
                    placeholderTextColor={colors.mutedForeground}
                    autoCapitalize="characters"
                    autoCorrect={false}
                  />
                </View>
              </>
            )}
          </>
        )}

        {step === "otp" && (
          <>
            <Text style={[s.otpInfo, { fontSize: 15, color: colors.foreground, marginBottom: 4 }]}>
              Verification Required
            </Text>
            <Text style={s.otpInfo}>
              A code was sent to {email}. Enter it below.
            </Text>
            <Text style={s.label}>Verification Code</Text>
            <View style={s.inputRow}>
              <TextInput
                style={[s.input, { letterSpacing: 8, textAlign: "center", fontSize: 20 }]}
                value={otpCode}
                onChangeText={setOtpCode}
                placeholder="000000"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />
            </View>
            <TouchableOpacity style={s.resendBtn} onPress={handleOtpResend}>
              <Text style={s.resendText}>Resend code</Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity style={s.primaryBtn} onPress={handleSubmit} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={s.primaryBtnText}>
              {step === "otp" ? "Verify" : mode === "login" ? "Sign In" : "Create Account"}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
