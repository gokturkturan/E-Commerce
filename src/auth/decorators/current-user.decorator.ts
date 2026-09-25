import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: string;
}

// createParamDecorator -> Nest'in kendi decoratorlarını tanımlamak için suduğu fonksiyon.
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    // ExecutionContext -> o anki isteğin tüm bağlamına erişim sağlıyor.
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
