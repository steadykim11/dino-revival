// SC-03 프로필 등록
// 프로필(User row)이 이미 있으면 알 선택으로 보낸다.
// (layout은 프로필 + 공룡이 모두 있을 때만 메인으로 보낸다)

import { redirect } from "next/navigation";
import { OnboardingProfileForm } from "@/components/profile/onboarding-profile-form";
import { getSession } from "@/lib/auth/session.server";

export default async function OnboardingPage() {
  const session = await getSession();
  if (session?.profile) redirect("/onboarding/egg");

  return <OnboardingProfileForm />;
}
