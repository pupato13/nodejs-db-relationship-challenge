import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
    id: string;
    quantity: number;
}

interface IRequest {
    customer_id: string;
    products: IProduct[];
}

@injectable()
class CreateOrderService {
    constructor(
        @inject("OrdersRepository")
        private ordersRepository: IOrdersRepository,
        @inject("ProductsRepository")
        private productsRepository: IProductsRepository,
        @inject("CustomersRepository")
        private customersRepository: ICustomersRepository,
    ) { }

    public async execute({ customer_id, products }: IRequest): Promise<Order> {
        // TODO
        const checkCustomerExists = await this.customersRepository.findById(customer_id);

        if (!checkCustomerExists) {
            throw new AppError("Customer not found");
        }

        const checkProductsExists = await this.productsRepository.findAllById(products);

        if (!checkProductsExists.length) {
            throw new AppError("Products not found");
        }

        const checkProductsIdsExists = checkProductsExists.map(product => product.id);

        const checkNonExistingProductsIds = products.filter(
            product => !checkProductsIdsExists.includes(product.id)
        );

        if (checkNonExistingProductsIds.length) {
            throw new AppError(`Product ${checkNonExistingProductsIds[0].id} not found`);
        }

        const checkProductsWithUnavailableQuantity = products.filter(
            product => checkProductsExists.filter(p => p.id === product.id)[0].quantity <
                product.quantity
        );

        if (checkProductsWithUnavailableQuantity.length) {
            const { quantity, id } = checkProductsWithUnavailableQuantity[0];
            throw new AppError(`The quantity of ${quantity} is not available for the product: ${id}`);
        }

        const serializedProducts = products.map(product => ({
            product_id: product.id,
            quantity: product.quantity,
            price: checkProductsExists.filter(p => p.id === product.id)[0].price
        }));

        const order = await this.ordersRepository.create({
            customer: checkCustomerExists,
            products: serializedProducts
        });

        const { order_products } = order;

        const productsToUpdateQuantity = order_products.map(product => ({
            id: product.product_id,
            quantity: checkProductsExists.filter(p => p.id === product.product_id)[0].quantity - product.quantity
        }));

        await this.productsRepository.updateQuantity(productsToUpdateQuantity);

        return order;
    }
}

export default CreateOrderService;
