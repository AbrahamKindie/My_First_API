-- AlterTable
CREATE SEQUENCE user_sort_order_seq;
ALTER TABLE "User" ALTER COLUMN "sort_order" SET DEFAULT nextval('user_sort_order_seq');
ALTER SEQUENCE user_sort_order_seq OWNED BY "User"."sort_order";
