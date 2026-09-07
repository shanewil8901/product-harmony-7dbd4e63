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
import { HrModule } from './hr/hr.module';
import { SalesModule } from './sales/sales.module';
import { InventoryModule } from './inventory/inventory.module';
import { HealthModule } from './health/health.module';
import { QueueModule } from './queue/queue.module';



@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get<string>('DB_HOST') ?? 'localhost',
        port: Number(config.get<string>('DB_PORT') ?? 3306),
        // Accept both naming styles so an existing .env keeps working.
        username: config.get<string>('DB_USERNAME') ?? config.get<string>('DB_USER'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DB_DATABASE') ?? config.get<string>('DB_NAME'),
        autoLoadEntities: true,
        // Schema auto-sync (dev). Set DB_SYNC=false to boot against legacy data
        // without letting TypeORM alter the schema.
        synchronize: (config.get<string>('DB_SYNC') ?? 'true') !== 'false',
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
    HrModule,
    SalesModule,
    InventoryModule,
    HealthModule,
    QueueModule.register(),
  ],
})
export class AppModule {}
