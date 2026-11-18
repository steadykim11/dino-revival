// SC-12 프로필·설정
// 서버에서 프로필을 읽어 클라이언트 화면(ProfileView)에 넘긴다.

import { ProfileView } from "@/components/profile/profile-view";
import { getAuthUser, requireSession } from "@/lib/auth/session.server";
import { getUserWithDinoAndGuild } from "@/lib/users/users.server";

export default async function ProfilePage() {
  // (main) 레이아웃이 온보딩까지 마친 사용자만 들여보낸다
  const me = await requireSession();
  const [authUser, user] = await Promise.all([
    getAuthUser(),
    getUserWithDinoAndGuild(me.id),
  ]);

  return (
    <ProfileView
      me={{
        auth: { id: me.id, email: authUser?.email ?? "" },
        profile: user
          ? {
              id: user.id,
              nickname: user.nickname,
              regionCode: user.regionCode,
              createdAt: user.createdAt.toISOString(),
              nicknameChangedAt: user.nicknameChangedAt?.toISOString() ?? null,
              regionChangedAt: user.regionChangedAt?.toISOString() ?? null,
            }
          : null,
        guild: user?.guild ? { displayName: user.guild.displayName } : null,
      }}
    />
  );
}
