export type Comment = {
  id: string;
  post_slug: string;
  author: string;
  content: string;
  is_secret: boolean;
  /** 비밀글 비밀번호 — 서버에서만 비교, 클라이언트에 절대 내려보내지 않음 */
  password_hash?: string;
  created_at: string;
};

/** 클라이언트에 전달하는 타입 (password_hash 제거) */
export type PublicComment = Omit<Comment, "password_hash">;
