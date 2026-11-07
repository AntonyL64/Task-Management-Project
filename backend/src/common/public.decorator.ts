import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Mặc định mọi route đều cần JWT. Gắn @Public() để mở một route (register, login). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
