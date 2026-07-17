import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { JwtSignOptions } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { MailService } from "./mail.service";
import { AdministrativeUnitsModule } from "../administrative-units/administrative-units.module";

@Module({
  imports: [
    AdministrativeUnitsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("jwtSecret") ?? "dev-secret-change-me",
        signOptions: {
          expiresIn: config.get<string>(
            "jwtExpiresIn",
            "7d",
          ) as JwtSignOptions["expiresIn"],
        } satisfies JwtSignOptions,
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, MailService],
  exports: [AuthService, JwtAuthGuard, JwtModule],
})
export class AuthModule {}
