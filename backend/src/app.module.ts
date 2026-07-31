import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsModule } from './products/products.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MasterDataModule } from './master-data/master-data.module';
import { BarcodesModule } from './barcodes/barcodes.module';
import { StockModule } from './stock/stock.module';
import { VendorsModule } from './vendors/vendors.module';
import { CustomersModule } from './customers/customers.module';
import { DashboardModule } from './dashboard/dashboard.module';



@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get<string>('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get<string>('DB_USERNAME'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DB_DATABASE'),
        autoLoadEntities: true,
        synchronize: true, // dev only
        charset: 'utf8mb4',
      }),
    }),
    AuthModule,
    UsersModule,
    MasterDataModule,
    BarcodesModule,
    ProductsModule,
    StockModule,
    VendorsModule,
    CustomersModule,
    DashboardModule,
  ],
})
export class AppModule {}
