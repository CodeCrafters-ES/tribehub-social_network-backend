// src/modules/account/dto/delete-account-request.dto.ts
//
// DTO vacío para POST /account/delete/request.
// El endpoint no requiere body, pero se declara la clase por coherencia
// arquitectónica (un DTO por endpoint) y para que el decorador @ApiBody
// pueda documentar el contrato en Swagger sin ambigüedades.
//
// ValidationPipe con forbidNonWhitelisted: true rechazará automáticamente
// cualquier campo que el cliente envíe en el body, ya que ninguno está
// declarado aquí como permitido.

export class DeleteAccountRequestDto {}
