import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './product.entity';
import { ProductHistory } from './product-history.entity';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { Vendor } from '../vendors/vendor.entity';
import { MasterDataModule } from '../master-data/master-data.module';

@Module({
  imports: [TypeOrmModule.forFeature([Product, ProductHistory, Vendor]), MasterDataModule],
  providers: [ProductsService],
  controllers: [ProductsController],
})
export class ProductsModule {}
