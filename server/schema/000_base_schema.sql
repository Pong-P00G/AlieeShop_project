--
-- AlieeShop — base schema baseline
--
-- The schema that predates everything in ../migrations/. It holds only the
-- core objects the migrations do not create: the tables (products, users,
-- category, orders, cart, stock, ...), their sequence/identity definitions,
-- indexes, FK constraints, the read-only views, and the pgcrypto extension.
--
-- Feature tables owned by migrations — notifications, audit_log, reviews,
-- refresh_tokens, permissions, role_permissions, store_settings,
-- wishlist_items and view_stock_low — are deliberately absent so that
-- `npm run migrate` creates them for real on a fresh database.
--
-- Applied automatically by `npm run setup`, and only when the target database
-- has no core tables yet. Never apply it to a database that already has them.
--
-- Regenerate against a database that has the core schema, excluding the
-- migration-owned objects (see README.md in this folder for the command).
--
-- PostgreSQL database dump
--

-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: touch_updated_at_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_updated_at_user() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updatedat := NOW();
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: cart; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cart (
    cartid integer NOT NULL,
    usersid integer NOT NULL,
    createdat timestamp with time zone DEFAULT now(),
    updatedat timestamp with time zone DEFAULT now()
);


--
-- Name: cart_cartid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.cart ALTER COLUMN cartid ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.cart_cartid_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: cartitems; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cartitems (
    cartitemid integer NOT NULL,
    cartid integer NOT NULL,
    productsid integer NOT NULL,
    variantid integer,
    quantity integer DEFAULT 1 NOT NULL,
    addedat timestamp with time zone DEFAULT now(),
    CONSTRAINT cartitems_quantity_check CHECK ((quantity > 0))
);


--
-- Name: cartitems_cartitemid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.cartitems ALTER COLUMN cartitemid ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.cartitems_cartitemid_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: category; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.category (
    categoriesid integer NOT NULL,
    parentid integer,
    categoryname character varying(50) NOT NULL,
    createdat timestamp with time zone DEFAULT now()
);


--
-- Name: category_categoriesid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.category ALTER COLUMN categoriesid ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.category_categoriesid_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: discounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.discounts (
    discountsid integer NOT NULL,
    productsid integer,
    variantid integer,
    amounts numeric(10,2) NOT NULL,
    startdate timestamp with time zone NOT NULL,
    enddate timestamp with time zone NOT NULL,
    createdat timestamp without time zone DEFAULT now(),
    CONSTRAINT discounts_amounts_check CHECK ((amounts > (0)::numeric)),
    CONSTRAINT discounts_check CHECK ((enddate > startdate))
);


--
-- Name: discounts_discountsid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.discounts ALTER COLUMN discountsid ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.discounts_discountsid_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: orderitems; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orderitems (
    orderitemid integer NOT NULL,
    ordersid integer NOT NULL,
    productsid integer NOT NULL,
    variantid integer,
    quantity integer NOT NULL,
    unitprice numeric(10,2) NOT NULL,
    subtotal numeric(10,2) GENERATED ALWAYS AS (((quantity)::numeric * unitprice)) STORED,
    createdat timestamp with time zone DEFAULT now(),
    CONSTRAINT orderitems_quantity_check CHECK ((quantity > 0)),
    CONSTRAINT orderitems_unitprice_check CHECK ((unitprice >= (0)::numeric))
);


--
-- Name: orderitems_orderitemid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.orderitems ALTER COLUMN orderitemid ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.orderitems_orderitemid_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    ordersid integer NOT NULL,
    usersid integer NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    totalamount numeric(10,2) DEFAULT 0,
    createdat timestamp with time zone DEFAULT now(),
    updatedat timestamp with time zone DEFAULT now(),
    CONSTRAINT orders_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'confirmed'::character varying, 'shipped'::character varying, 'delivered'::character varying, 'cancelled'::character varying])::text[]))),
    CONSTRAINT orders_totalamount_check CHECK ((totalamount >= (0)::numeric))
);


--
-- Name: orders_ordersid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.orders ALTER COLUMN ordersid ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.orders_ordersid_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: paymentmethod; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.paymentmethod (
    methodsid integer NOT NULL,
    methodname character varying(100) NOT NULL,
    description character varying(300),
    isactive boolean DEFAULT true,
    fee numeric(10,2) DEFAULT 0.00 NOT NULL
);


--
-- Name: paymentmethod_methodsid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.paymentmethod ALTER COLUMN methodsid ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.paymentmethod_methodsid_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    paymentsid integer NOT NULL,
    ordersid integer NOT NULL,
    methodsid integer NOT NULL,
    discountsid integer,
    amount numeric(10,2) NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    paidat timestamp with time zone DEFAULT now(),
    CONSTRAINT payments_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT payments_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'paid'::character varying, 'failed'::character varying, 'refunded'::character varying])::text[])))
);


--
-- Name: payments_paymentsid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.payments ALTER COLUMN paymentsid ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.payments_paymentsid_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: productimages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.productimages (
    imageid integer NOT NULL,
    productsid integer NOT NULL,
    imageurl text NOT NULL,
    alttext character varying(255),
    isthumbnail boolean DEFAULT false,
    sortorder integer DEFAULT 0,
    createdat timestamp with time zone DEFAULT now()
);


--
-- Name: productimages_imageid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.productimages ALTER COLUMN imageid ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.productimages_imageid_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    productsid integer NOT NULL,
    categoriesid integer NOT NULL,
    productname character varying(300) NOT NULL,
    baseprice numeric(10,2) NOT NULL,
    description text,
    status character varying(50) DEFAULT 'active'::character varying NOT NULL,
    createdat timestamp with time zone DEFAULT now(),
    updatedat timestamp with time zone DEFAULT now(),
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    CONSTRAINT products_baseprice_check CHECK ((baseprice >= (0)::numeric)),
    CONSTRAINT products_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'archived'::character varying])::text[])))
);


--
-- Name: products_productsid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.products ALTER COLUMN productsid ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.products_productsid_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    rolesid integer NOT NULL,
    rolename character varying(50) NOT NULL,
    description character varying(250),
    createdat timestamp with time zone DEFAULT now(),
    level integer DEFAULT 3 NOT NULL
);


--
-- Name: roles_rolesid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.roles ALTER COLUMN rolesid ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.roles_rolesid_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: stock; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock (
    stockid integer NOT NULL,
    productsid integer NOT NULL,
    variantid integer,
    quantity integer DEFAULT 0 NOT NULL,
    minstock integer DEFAULT 5,
    updatedat timestamp with time zone DEFAULT now(),
    CONSTRAINT stock_quantity_check CHECK ((quantity >= 0))
);


--
-- Name: stock_stockid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.stock ALTER COLUMN stockid ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.stock_stockid_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: stocklog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stocklog (
    logid integer NOT NULL,
    stockid integer NOT NULL,
    usersid integer,
    changetype character varying(50) NOT NULL,
    quantity integer NOT NULL,
    reason character varying(300),
    createdat timestamp with time zone DEFAULT now(),
    CONSTRAINT stocklog_changetype_check CHECK (((changetype)::text = ANY ((ARRAY['IN'::character varying, 'OUT'::character varying, 'ADJUST'::character varying, 'RETURN'::character varying, 'DAMAGED'::character varying])::text[])))
);


--
-- Name: stocklog_logid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.stocklog ALTER COLUMN logid ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.stocklog_logid_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    usersid integer NOT NULL,
    rolesid integer NOT NULL,
    username character varying(255) NOT NULL,
    email character varying(250) NOT NULL,
    firstname character varying(100) NOT NULL,
    midname character varying(100),
    lastname character varying(100) NOT NULL,
    fullname character varying(300) GENERATED ALWAYS AS (((((firstname)::text || ' '::text) || COALESCE(((midname)::text || ' '::text), ''::text)) || (lastname)::text)) STORED,
    passwordhash character varying(250) NOT NULL,
    isactive boolean DEFAULT true,
    createdat timestamp with time zone DEFAULT now(),
    updatedat timestamp with time zone DEFAULT now()
);


--
-- Name: users_usersid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.users ALTER COLUMN usersid ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.users_usersid_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: variantattribute; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.variantattribute (
    attributeid integer NOT NULL,
    attributename character varying(100) NOT NULL
);


--
-- Name: variantattribute_attributeid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.variantattribute ALTER COLUMN attributeid ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.variantattribute_attributeid_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: variantattributevalue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.variantattributevalue (
    valueid integer NOT NULL,
    attributeid integer NOT NULL,
    value character varying(100) NOT NULL
);


--
-- Name: variantattributevalue_valueid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.variantattributevalue ALTER COLUMN valueid ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.variantattributevalue_valueid_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: variantoptionvalue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.variantoptionvalue (
    variantid integer NOT NULL,
    valueid integer NOT NULL
);


--
-- Name: variants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.variants (
    variantid integer NOT NULL,
    productsid integer NOT NULL,
    sku character varying(100) NOT NULL,
    createdat timestamp with time zone DEFAULT now(),
    price numeric(10,2) DEFAULT NULL::numeric
);


--
-- Name: variants_variantid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.variants ALTER COLUMN variantid ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.variants_variantid_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: view_cart; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.view_cart AS
 SELECT ci.cartitemid,
    c.usersid,
    u.username,
    p.productname,
    v.sku,
    p.baseprice AS currentprice,
    ci.quantity,
    round((p.baseprice * (ci.quantity)::numeric), 2) AS linetotal,
    ci.addedat
   FROM ((((public.cartitems ci
     JOIN public.cart c ON ((ci.cartid = c.cartid)))
     JOIN public.users u ON ((c.usersid = u.usersid)))
     JOIN public.products p ON ((ci.productsid = p.productsid)))
     LEFT JOIN public.variants v ON ((ci.variantid = v.variantid)));


--
-- Name: view_order_detail; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.view_order_detail AS
 SELECT oi.orderitemid,
    o.ordersid,
    u.username,
    p.productname,
    v.sku,
    oi.quantity,
    oi.unitprice,
    oi.subtotal,
    o.status,
    o.createdat
   FROM ((((public.orderitems oi
     JOIN public.orders o ON ((oi.ordersid = o.ordersid)))
     JOIN public.users u ON ((o.usersid = u.usersid)))
     JOIN public.products p ON ((oi.productsid = p.productsid)))
     LEFT JOIN public.variants v ON ((oi.variantid = v.variantid)));


--
-- Name: view_orders; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.view_orders AS
 SELECT o.ordersid,
    u.username,
    u.email,
    o.status AS orderstatus,
    o.totalamount,
    pay.status AS paymentstatus,
    pm.methodname AS paymentmethod,
    o.createdat
   FROM (((public.orders o
     JOIN public.users u ON ((o.usersid = u.usersid)))
     LEFT JOIN public.payments pay ON ((o.ordersid = pay.ordersid)))
     LEFT JOIN public.paymentmethod pm ON ((pay.methodsid = pm.methodsid)));


--
-- Name: view_products; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.view_products AS
 SELECT p.productsid,
    p.productname,
    p.baseprice,
    p.description,
    p.status,
    c.categoryname,
    pi.imageurl AS thumbnail,
    COALESCE(sum(s.quantity), (0)::bigint) AS totalstock,
    p.createdat,
    p.tags
   FROM (((public.products p
     JOIN public.category c ON ((p.categoriesid = c.categoriesid)))
     LEFT JOIN public.productimages pi ON (((p.productsid = pi.productsid) AND (pi.isthumbnail = true))))
     LEFT JOIN public.stock s ON ((p.productsid = s.productsid)))
  GROUP BY p.productsid, p.productname, p.baseprice, p.description, p.status, c.categoryname, pi.imageurl, p.createdat, p.tags;


--
-- Name: view_users; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.view_users AS
 SELECT u.usersid,
    u.username,
    u.email,
    u.fullname,
    u.firstname,
    u.midname,
    u.lastname,
    r.rolename,
    u.isactive,
    u.createdat
   FROM (public.users u
     JOIN public.roles r ON ((u.rolesid = r.rolesid)));


--
-- Name: cart cart_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart
    ADD CONSTRAINT cart_pkey PRIMARY KEY (cartid);


--
-- Name: cart cart_usersid_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart
    ADD CONSTRAINT cart_usersid_key UNIQUE (usersid);


--
-- Name: cartitems cartitems_cartid_productsid_variantid_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cartitems
    ADD CONSTRAINT cartitems_cartid_productsid_variantid_key UNIQUE (cartid, productsid, variantid);


--
-- Name: cartitems cartitems_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cartitems
    ADD CONSTRAINT cartitems_pkey PRIMARY KEY (cartitemid);


--
-- Name: category category_categoryname_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category
    ADD CONSTRAINT category_categoryname_key UNIQUE (categoryname);


--
-- Name: category category_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category
    ADD CONSTRAINT category_pkey PRIMARY KEY (categoriesid);


--
-- Name: discounts discounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discounts
    ADD CONSTRAINT discounts_pkey PRIMARY KEY (discountsid);


--
-- Name: orderitems orderitems_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orderitems
    ADD CONSTRAINT orderitems_pkey PRIMARY KEY (orderitemid);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (ordersid);


--
-- Name: paymentmethod paymentmethod_methodname_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.paymentmethod
    ADD CONSTRAINT paymentmethod_methodname_key UNIQUE (methodname);


--
-- Name: paymentmethod paymentmethod_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.paymentmethod
    ADD CONSTRAINT paymentmethod_pkey PRIMARY KEY (methodsid);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (paymentsid);


--
-- Name: productimages productimages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productimages
    ADD CONSTRAINT productimages_pkey PRIMARY KEY (imageid);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (productsid);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (rolesid);


--
-- Name: roles roles_rolename_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_rolename_key UNIQUE (rolename);


--
-- Name: stock stock_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock
    ADD CONSTRAINT stock_pkey PRIMARY KEY (stockid);


--
-- Name: stock stock_productsid_variantid_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock
    ADD CONSTRAINT stock_productsid_variantid_key UNIQUE (productsid, variantid);


--
-- Name: stocklog stocklog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stocklog
    ADD CONSTRAINT stocklog_pkey PRIMARY KEY (logid);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (usersid);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: variantattribute variantattribute_attributename_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variantattribute
    ADD CONSTRAINT variantattribute_attributename_key UNIQUE (attributename);


--
-- Name: variantattribute variantattribute_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variantattribute
    ADD CONSTRAINT variantattribute_pkey PRIMARY KEY (attributeid);


--
-- Name: variantattributevalue variantattributevalue_attributeid_value_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variantattributevalue
    ADD CONSTRAINT variantattributevalue_attributeid_value_key UNIQUE (attributeid, value);


--
-- Name: variantattributevalue variantattributevalue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variantattributevalue
    ADD CONSTRAINT variantattributevalue_pkey PRIMARY KEY (valueid);


--
-- Name: variantoptionvalue variantoptionvalue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variantoptionvalue
    ADD CONSTRAINT variantoptionvalue_pkey PRIMARY KEY (variantid, valueid);


--
-- Name: variants variants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variants
    ADD CONSTRAINT variants_pkey PRIMARY KEY (variantid);


--
-- Name: variants variants_sku_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variants
    ADD CONSTRAINT variants_sku_key UNIQUE (sku);


--
-- Name: idx_cartitems_cart; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cartitems_cart ON public.cartitems USING btree (cartid);


--
-- Name: idx_discounts_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_discounts_product ON public.discounts USING btree (productsid);


--
-- Name: idx_orderitems_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orderitems_order ON public.orderitems USING btree (ordersid);


--
-- Name: idx_orders_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_user ON public.orders USING btree (usersid);


--
-- Name: idx_payments_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_order ON public.payments USING btree (ordersid);


--
-- Name: idx_products_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_category ON public.products USING btree (categoriesid);


--
-- Name: idx_stock_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_product ON public.stock USING btree (productsid);


--
-- Name: idx_stock_variant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_variant ON public.stock USING btree (variantid);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_rolesid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_rolesid ON public.users USING btree (rolesid);


--
-- Name: idx_variants_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_variants_product ON public.variants USING btree (productsid);


--
-- Name: users trg_touch_updated_at_user; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_touch_updated_at_user BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_user();


--
-- Name: cart cart_usersid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart
    ADD CONSTRAINT cart_usersid_fkey FOREIGN KEY (usersid) REFERENCES public.users(usersid) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: cartitems cartitems_cartid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cartitems
    ADD CONSTRAINT cartitems_cartid_fkey FOREIGN KEY (cartid) REFERENCES public.cart(cartid) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: cartitems cartitems_productsid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cartitems
    ADD CONSTRAINT cartitems_productsid_fkey FOREIGN KEY (productsid) REFERENCES public.products(productsid) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: cartitems cartitems_variantid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cartitems
    ADD CONSTRAINT cartitems_variantid_fkey FOREIGN KEY (variantid) REFERENCES public.variants(variantid) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: category category_parentid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category
    ADD CONSTRAINT category_parentid_fkey FOREIGN KEY (parentid) REFERENCES public.category(categoriesid) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: discounts discounts_productsid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discounts
    ADD CONSTRAINT discounts_productsid_fkey FOREIGN KEY (productsid) REFERENCES public.products(productsid) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: discounts discounts_variantid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discounts
    ADD CONSTRAINT discounts_variantid_fkey FOREIGN KEY (variantid) REFERENCES public.variants(variantid) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: orderitems orderitems_ordersid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orderitems
    ADD CONSTRAINT orderitems_ordersid_fkey FOREIGN KEY (ordersid) REFERENCES public.orders(ordersid) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: orderitems orderitems_productsid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orderitems
    ADD CONSTRAINT orderitems_productsid_fkey FOREIGN KEY (productsid) REFERENCES public.products(productsid) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: orderitems orderitems_variantid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orderitems
    ADD CONSTRAINT orderitems_variantid_fkey FOREIGN KEY (variantid) REFERENCES public.variants(variantid) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: orders orders_usersid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_usersid_fkey FOREIGN KEY (usersid) REFERENCES public.users(usersid) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: payments payments_discountsid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_discountsid_fkey FOREIGN KEY (discountsid) REFERENCES public.discounts(discountsid) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: payments payments_methodsid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_methodsid_fkey FOREIGN KEY (methodsid) REFERENCES public.paymentmethod(methodsid) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: payments payments_ordersid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_ordersid_fkey FOREIGN KEY (ordersid) REFERENCES public.orders(ordersid) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: productimages productimages_productsid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productimages
    ADD CONSTRAINT productimages_productsid_fkey FOREIGN KEY (productsid) REFERENCES public.products(productsid) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: products products_categoriesid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_categoriesid_fkey FOREIGN KEY (categoriesid) REFERENCES public.category(categoriesid) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: stock stock_productsid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock
    ADD CONSTRAINT stock_productsid_fkey FOREIGN KEY (productsid) REFERENCES public.products(productsid) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: stock stock_variantid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock
    ADD CONSTRAINT stock_variantid_fkey FOREIGN KEY (variantid) REFERENCES public.variants(variantid) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: stocklog stocklog_stockid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stocklog
    ADD CONSTRAINT stocklog_stockid_fkey FOREIGN KEY (stockid) REFERENCES public.stock(stockid) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: stocklog stocklog_usersid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stocklog
    ADD CONSTRAINT stocklog_usersid_fkey FOREIGN KEY (usersid) REFERENCES public.users(usersid) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: users users_rolesid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_rolesid_fkey FOREIGN KEY (rolesid) REFERENCES public.roles(rolesid) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: variantattributevalue variantattributevalue_attributeid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variantattributevalue
    ADD CONSTRAINT variantattributevalue_attributeid_fkey FOREIGN KEY (attributeid) REFERENCES public.variantattribute(attributeid) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: variantoptionvalue variantoptionvalue_valueid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variantoptionvalue
    ADD CONSTRAINT variantoptionvalue_valueid_fkey FOREIGN KEY (valueid) REFERENCES public.variantattributevalue(valueid) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: variantoptionvalue variantoptionvalue_variantid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variantoptionvalue
    ADD CONSTRAINT variantoptionvalue_variantid_fkey FOREIGN KEY (variantid) REFERENCES public.variants(variantid) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: variants variants_productsid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variants
    ADD CONSTRAINT variants_productsid_fkey FOREIGN KEY (productsid) REFERENCES public.products(productsid) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--


