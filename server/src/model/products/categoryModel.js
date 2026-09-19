import db from '../../database/dbpool.js';

export const getAllCategories = async () => {
    const { rows } = await db.query(
        `SELECT c.categoriesid AS category_id,
                c.categoryname AS name,
                c.parentid AS parent_id,
                c.createdat AS created_at,
                COUNT(p.productsid)::int AS product_count
         FROM category c
         LEFT JOIN products p ON p.categoriesid = c.categoriesid
         GROUP BY c.categoriesid, c.categoryname, c.parentid, c.createdat
         ORDER BY c.categoryname`
    );
    return rows;
};

export const getCategoryById = async (categoryId) => {
    const { rows } = await db.query(
        `SELECT categoriesid AS category_id, categoryname AS name, parentid AS parent_id, createdat AS created_at
         FROM category WHERE categoriesid = $1`,
        [categoryId]
    );
    return rows[0];
};

export const createCategory = async (name) => {
    const { rows } = await db.query(
        `INSERT INTO category (categoryname) VALUES ($1) RETURNING categoriesid`,
        [name]
    );
    return rows[0].categoriesid;
};

export const updateCategory = async (categoryId, name) => {
    const result = await db.query(
        `UPDATE category SET categoryname = $1 WHERE categoriesid = $2`,
        [name, categoryId]
    );
    return result.rowCount;
};

export const deleteCategory = async (categoryId) => {
    const result = await db.query(
        `DELETE FROM category WHERE categoriesid = $1`,
        [categoryId]
    );
    return result.rowCount > 0;
};

export const categoryExists = async (categoryId) => {
    const { rows } = await db.query(
        `SELECT categoriesid FROM category WHERE categoriesid = $1`,
        [categoryId]
    );
    return rows.length > 0;
};
