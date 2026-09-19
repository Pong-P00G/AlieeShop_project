import { defineStore } from 'pinia';
import { productAPI } from '../api/products/productApi.js';
import { categoryAPI } from '../api/products/categoryApi.js';
import { imageAPI } from '../api/products/imageApi.js';
import { variantAPI } from '../api/products/variantApi.js';
import { stockAPI } from '../api/products/stockApi.js';

export const useProductStore = defineStore('product', {
    state: () => ({
        // Products
        products: [],
        currentProduct: null,
        paginatedProducts: {
            page: 1,
            pageSize: 10,
            totalItems: 0,
            totalPages: 0,
            items: []
        },
        featuredProducts: [],
        newArrivals: [],
        comingSoon: [],
        bestSellers: [],
        
        // Categories
        categories: [],
        currentCategory: null,
        
        // UI States
        loading: false,
        error: null,
        successMessage: null,
        
        // Filters
        filters: {
            search: '',
            category: null,
            minPrice: null,
            maxPrice: null,
            status: 'active'
        }
    }),

    getters: {
        getProducts: (state) => state.products,
        getCurrentProduct: (state) => state.currentProduct,
        getCompleteProduct: (state) => state.currentProduct,
        getPaginatedData: (state) => state.paginatedProducts,
        getFeaturedProducts: (state) => state.featuredProducts,
        getNewArrivals: (state) => state.newArrivals,
        getComingSoon: (state) => state.comingSoon,
        getBestSellers: (state) => state.bestSellers,
        getCategories: (state) => state.categories,
        isLoading: (state) => state.loading,
        getError: (state) => state.error,
        getSuccessMessage: (state) => state.successMessage,
        getFilters: (state) => state.filters,
        getProductsByCategory: (state) => (categoryName) => {
            return state.products.filter(p => p.category_name === categoryName);
        },
        getProductById: (state) => (productId) => {
            return state.products.find(p => p.product_id === parseInt(productId));
        },
        hasProducts: (state) => state.paginatedProducts.items.length > 0,
        getTotalPages: (state) => state.paginatedProducts.totalPages
    },

    actions: {
        /**
         * Fetch all products
         */
        async fetchAllProducts() {
            this.loading = true;
            this.error = null;
            
            try {
                const response = await productAPI.getAllProducts();
                
                // Handle different response formats
                if (response.success && response.data) {
                    this.products = response.data;
                } else if (Array.isArray(response)) {
                    this.products = response;
                } else if (response.data && Array.isArray(response.data)) {
                    this.products = response.data;
                } else {
                    this.products = [];
                }
                
            } catch (error) {
                const errorMsg = error.response?.data?.message || error.message || 'Failed to fetch products';
                this.error = errorMsg;
                return { success: false, error: errorMsg };
            } finally {
                this.loading = false;
            }
        },
        
        /**
         * Fetch paginated products with filters
         * FIXED: Now properly handles your API response format
         */
        async fetchPaginatedProducts(page = 1, pageSize = 10) {
            this.loading = true;
            this.error = null;
            
            try {
                
                
                const params = {
                    page,
                    pageSize,
                    ...this.filters
                };
                
                const response = await productAPI.getPaginatedProduct(params);
    
                // Handle different response formats
                if (response && response.items) {
                    // Format 1: { page, items, ... }
                    this.paginatedProducts = response;
                } else if (response.data && Array.isArray(response.data)) {
                    // Format 2: { success, data: [...] } ← YOUR FORMAT!
                    this.paginatedProducts = {
                        page: page,
                        pageSize: pageSize,
                        totalItems: response.data.length,
                        totalPages: 1,
                        items: response.data  // Map Item Data
                    };
                }
                
                
                
                
                return { success: true, data: this.paginatedProducts };
            } catch (error) {
                const errorMsg = error.response?.data?.message || error.message || 'Failed to fetch products';
                this.error = errorMsg;
                console.error('Fetch paginated products error:', error);
                console.error('Error response:', error.response);
                return { success: false, error: errorMsg };
            } finally {
                this.loading = false;
            }
        },
        
        /**
         * Search products with filters
         */
        async searchProducts(filters = {}) {
            this.loading = true;
            this.error = null;
            
            try {
                
                const response = await productAPI.searchProducts(filters);
                
                
                // Handle response
                if (response.success && response.data) {
                    this.products = response.data;
                } else if (Array.isArray(response)) {
                    this.products = response;
                } else if (response.data && Array.isArray(response.data)) {
                    this.products = response.data;
                } else {
                    this.products = [];
                }
                
                return { success: true, data: this.products };
            } catch (error) {
                const errorMsg = error.response?.data?.message || error.message || 'Search failed';
                this.error = errorMsg;
                console.error('Search products error:', error);
                return { success: false, error: errorMsg };
            } finally {
                this.loading = false;
            }
        },
        
        /**
         * Fetch product by ID with full details
         */
        async fetchProductById(productId) {
            this.loading = true;
            this.error = null;
            
            try {
                
                const response = await productAPI.getProductById(productId);
                
                
                // Handle response
                if (response.success && response.data) {
                    this.currentProduct = response.data;
                } else if (response.data) {
                    this.currentProduct = response.data;
                } else {
                    this.currentProduct = response;
                }
                
                return { success: true, data: this.currentProduct };
            } catch (error) {
                const errorMsg = error.response?.data?.message || error.message || 'Failed to fetch product';
                this.error = errorMsg;
                console.error('Fetch product by ID error:', error);
                return { success: false, error: errorMsg };
            } finally {
                this.loading = false;
            }
        },
        
        /**
         * Fetch featured products
         */
        async fetchFeaturedProducts(limit = 10) {
            this.loading = true;
            this.error = null;
            
            try {
                const response = await productAPI.getFeaturedProducts(limit);
                
                if (response.success && response.data) {
                    this.featuredProducts = response.data;
                } else if (Array.isArray(response)) {
                    this.featuredProducts = response;
                } else if (response.data && Array.isArray(response.data)) {
                    this.featuredProducts = response.data;
                } else {
                    this.featuredProducts = [];
                }
                
                return { success: true, data: this.featuredProducts };
            } catch (error) {
                const errorMsg = error.response?.data?.message || error.message || 'Failed to fetch featured products';
                this.error = errorMsg;
                console.error('Fetch featured products error:', error);
                return { success: false, error: errorMsg };
            } finally {
                this.loading = false;
            }
        },

        /**
         * Fetch new arrivals
         */
        async fetchNewArrivals(limit = 10) {
            try {
                const response = await productAPI.getNewArrivals(limit);
                
                if (response.success && response.data) {
                    this.newArrivals = response.data;
                } else if (Array.isArray(response)) {
                    this.newArrivals = response;
                } else if (response.data && Array.isArray(response.data)) {
                    this.newArrivals = response.data;
                } else {
                    this.newArrivals = [];
                }
                
                return { success: true, data: this.newArrivals };
            } catch (error) {
                console.error('Fetch new arrivals error:', error);
                return { success: false, error: error.message };
            }
        },

        /**
         * Fetch coming soon products
         */
        async fetchComingSoon(limit = 10) {
            try {
                const response = await productAPI.getComingSoon(limit);
                
                if (response.success && response.data) {
                    this.comingSoon = response.data;
                } else if (Array.isArray(response)) {
                    this.comingSoon = response;
                } else if (response.data && Array.isArray(response.data)) {
                    this.comingSoon = response.data;
                } else {
                    this.comingSoon = [];
                }
                
                return { success: true, data: this.comingSoon };
            } catch (error) {
                console.error('Fetch coming soon error:', error);
                return { success: false, error: error.message };
            }
        },

        /**
         * Fetch best sellers
         */
        async fetchBestSellers(limit = 10) {
            try {
                const response = await productAPI.getBestSellers(limit);
                
                if (response.success && response.data) {
                    this.bestSellers = response.data;
                } else if (Array.isArray(response)) {
                    this.bestSellers = response;
                } else if (response.data && Array.isArray(response.data)) {
                    this.bestSellers = response.data;
                } else {
                    this.bestSellers = [];
                }
                
                return { success: true, data: this.bestSellers };
            } catch (error) {
                console.error('Fetch best sellers error:', error);
                return { success: false, error: error.message };
            }
        },
        
        /**
         * Fetch products by category
         */
        async fetchProductsByCategory(categoryName) {
            this.loading = true;
            this.error = null;
            
            try {
                const response = await productAPI.getProductsByCategory(categoryName);
                
                if (response.success && response.data) {
                    this.products = response.data;
                } else if (Array.isArray(response)) {
                    this.products = response;
                } else if (response.data && Array.isArray(response.data)) {
                    this.products = response.data;
                } else {
                    this.products = [];
                }
                
                return { success: true, data: this.products };
            } catch (error) {
                const errorMsg = error.response?.data?.message || error.message || 'Failed to fetch products';
                this.error = errorMsg;
                console.error('Fetch products by category error:', error);
                return { success: false, error: errorMsg };
            } finally {
                this.loading = false;
            }
        },
        
        /**
         * Create complete product with images, variants, and stock
         */
        async createCompleteProduct(productData) {
            this.loading = true;
            this.error = null;
            this.successMessage = null;
            
            try {
                const response = await productAPI.createCompleteProduct(productData);
                
                this.successMessage = 'Product created successfully!';
                
                // Refresh products list
                await this.fetchPaginatedProducts(1);
                
                return { success: true, data: response.data || response };
            } catch (error) {
                const errorData = error.response?.data;
                let errorMsg;
                if (errorData?.errors && Array.isArray(errorData.errors) && errorData.errors.length > 0) {
                    // Validation errors from validateCompleteProduct et al.
                    errorMsg = errorData.errors.map(e => e.message).join('; ');
                } else if (errorData?.message) {
                    errorMsg = errorData.message;
                } else if (errorData?.error) {
                    errorMsg = errorData.error;
                } else {
                    errorMsg = error.message || 'Failed to create product';
                }
                this.error = errorMsg;
                console.error('Create complete product error:', error);
                return {
                    success: false,
                    error: errorMsg,
                    fieldErrors: errorData?.errors || null
                };
            } finally {
                this.loading = false;
            }
        },
        
        /**
         * Update product
         */
        async updateProduct(productId, productData) {
            this.loading = true;
            this.error = null;
            this.successMessage = null;
            
            try {
                const response = await productAPI.updateProduct(productId, productData);
                
                this.successMessage = 'Product updated successfully!';
                
                const updatedProduct = response.data || response;
                
                // Update in current list
                const index = this.products.findIndex(p => p.product_id === productId);
                if (index !== -1) {
                    this.products[index] = updatedProduct;
                }
                
                // Update current product if it's the one being edited
                if (this.currentProduct?.product_id === productId) {
                    this.currentProduct = updatedProduct;
                }
                
                return { success: true, data: updatedProduct };
            } catch (error) {
                const errorData = error.response?.data;
                let errorMsg;
                if (errorData?.errors && Array.isArray(errorData.errors) && errorData.errors.length > 0) {
                    // Validation errors from validateCompleteProduct et al.
                    errorMsg = errorData.errors.map(e => e.message).join('; ');
                } else if (errorData?.message) {
                    errorMsg = errorData.message;
                } else if (errorData?.error) {
                    errorMsg = errorData.error;
                } else {
                    errorMsg = error.message || 'Failed to update product';
                }
                this.error = errorMsg;
                console.error('Update product error:', error);
                return {
                    success: false,
                    error: errorMsg,
                    fieldErrors: errorData?.errors || null
                };
            } finally {
                this.loading = false;
            }
        },
        
        /**
         * Delete product
         */
        async deleteProduct(productId) {
            this.loading = true;
            this.error = null;
            this.successMessage = null;
            
            try {
                await productAPI.deleteProduct(productId);
                
                this.successMessage = 'Product deleted successfully!';
                
                // Remove from list
                this.products = this.products.filter(p => p.product_id !== productId);
                
                // Refresh paginated list
                await this.fetchPaginatedProducts(this.paginatedProducts.page);
                
                return { success: true };
            } catch (error) {
                const errorMsg = error.response?.data?.message || error.message || 'Failed to delete product';
                this.error = errorMsg;
                console.error('Delete product error:', error);
                return { success: false, error: errorMsg };
            } finally {
                this.loading = false;
            }
        },
        
        /**
         * Bulk create products
         */
        async bulkCreateProducts(productsArray) {
            this.loading = true;
            this.error = null;
            this.successMessage = null;
            
            try {
                const response = await productAPI.bulkCreateProducts(productsArray);
                
                const created = response.data?.created || productsArray.length;
                this.successMessage = `${created} products created successfully!`;
                
                // Refresh products list
                await this.fetchPaginatedProducts(1);
                
                return { success: true, data: response.data || response };
            } catch (error) {
                const errorMsg = error.response?.data?.message || error.message || 'Failed to create products';
                this.error = errorMsg;
                console.error('Bulk create products error:', error);
                return { success: false, error: errorMsg };
            } finally {
                this.loading = false;
            }
        },
        // ==================== CATEGORY ACTIONS ====================
        
        /**
         * Fetch all categories
         */
        async fetchCategories() {
            this.loading = true;
            this.error = null;
            
            try {
                const response = await categoryAPI.getAllCategories();
                this.categories = response.data || [];
                return { success: true, data: this.categories };
            } catch (error) {
                this.error = error.response?.data?.message || 'Failed to fetch categories';
                console.error('Fetch categories error:', error);
                return { success: false, error: this.error };
            } finally {
                this.loading = false;
            }
        },
        
        /**
         * Fetch category by ID
         */
        async fetchCategoryById(categoryId) {
            this.loading = true;
            this.error = null;
            
            try {
                const response = await categoryAPI.getCategoryById(categoryId);
                this.currentCategory = response.data;
                return { success: true, data: this.currentCategory };
            } catch (error) {
                this.error = error.response?.data?.message || 'Failed to fetch category';
                console.error('Fetch category by ID error:', error);
                return { success: false, error: this.error };
            } finally {
                this.loading = false;
            }
        },
        
        /**
         * Create new category
         */
        async createCategory(name) {
            this.loading = true;
            this.error = null;
            this.successMessage = null;
            
            try {
                const response = await categoryAPI.createCategory(name);
                this.categories.push(response.data);
                this.successMessage = 'Category created successfully!';
                return { success: true, data: response.data };
            } catch (error) {
                const errorMsg = error.response?.data?.message || 'Failed to create category';
                this.error = errorMsg;
                console.error('Create category error:', error);
                return { success: false, error: errorMsg };
            } finally {
                this.loading = false;
            }
        },
        
        /**
         * Update category
         */
        async updateCategory(categoryId, name) {
            this.loading = true;
            this.error = null;
            this.successMessage = null;
            
            try {
                const response = await categoryAPI.updateCategory(categoryId, name);
                
                // Update in categories list
                const index = this.categories.findIndex(c => c.category_id === categoryId);
                if (index !== -1) {
                    this.categories[index] = response.data;
                }
                
                this.successMessage = 'Category updated successfully!';
                return { success: true, data: response.data };
            } catch (error) {
                const errorMsg = error.response?.data?.message || 'Failed to update category';
                this.error = errorMsg;
                console.error('Update category error:', error);
                return { success: false, error: errorMsg };
            } finally {
                this.loading = false;
            }
        },
        
        /**
         * Delete category
         */
        async deleteCategory(categoryId) {
            this.loading = true;
            this.error = null;
            this.successMessage = null;
            
            try {
                await categoryAPI.deleteCategory(categoryId);
                this.categories = this.categories.filter(c => c.category_id !== categoryId);
                this.successMessage = 'Category deleted successfully!';
                return { success: true };
            } catch (error) {
                const errorMsg = error.response?.data?.message || 'Failed to delete category';
                this.error = errorMsg;
                console.error('Delete category error:', error);
                return { success: false, error: errorMsg };
            } finally {
                this.loading = false;
            }
        },
        
        // ==================== IMAGE ACTIONS ====================
        
        /**
         * Add product image
         */
        async addProductImage(productId, imageUrl, isMain = false) {
            this.loading = true;
            this.error = null;
            
            try {
                const response = await imageAPI.addProductImage(productId, imageUrl, isMain);
                return { success: true, data: response.data };
            } catch (error) {
                this.error = error.response?.data?.message || 'Failed to add image';
                console.error('Add product image error:', error);
                return { success: false, error: this.error };
            } finally {
                this.loading = false;
            }
        },
        
        /**
         * Delete product image
         */
        async deleteProductImage(productId, imageId) {
            this.loading = true;
            this.error = null;
            
            try {
                await imageAPI.deleteProductImage(productId, imageId);
                return { success: true };
            } catch (error) {
                this.error = error.response?.data?.message || 'Failed to delete image';
                console.error('Delete product image error:', error);
                return { success: false, error: this.error };
            } finally {
                this.loading = false;
            }
        },
        
        // ==================== VARIANT ACTIONS ====================
        
        /**
         * Create product variant
         */
        async createVariant(variantData) {
            this.loading = true;
            this.error = null;
            
            try {
                const response = await variantAPI.createVariant(variantData);
                return { success: true, data: response.data };
            } catch (error) {
                this.error = error.response?.data?.message || 'Failed to create variant';
                console.error('Create variant error:', error);
                return { success: false, error: this.error };
            } finally {
                this.loading = false;
            }
        },
        
        // ==================== STOCK ACTIONS ====================
        
        /**
         * Update variant stock
         */
        async updateStock(variantId, quantity, reorderLevel = 5) {
            this.loading = true;
            this.error = null;
            
            try {
                const response = await stockAPI.updateStock(variantId, quantity, reorderLevel);
                return { success: true, data: response.data };
            } catch (error) {
                this.error = error.response?.data?.message || 'Failed to update stock';
                console.error('Update stock error:', error);
                return { success: false, error: this.error };
            } finally {
                this.loading = false;
            }
        },
        
        /**
         * Get low stock products
         */
        async getLowStockProducts() {
            this.loading = true;
            this.error = null;
            
            try {
                const response = await stockAPI.getLowStockProducts();
                return { success: true, data: response.data };
            } catch (error) {
                this.error = error.response?.data?.message || 'Failed to fetch low stock products';
                console.error('Get low stock products error:', error);
                return { success: false, error: this.error };
            } finally {
                this.loading = false;
            }
        },
        
        // ==================== FILTER ACTIONS ====================
        
        /**
         * Update filters
         */
        setFilters(newFilters) {
            this.filters = { ...this.filters, ...newFilters };
        },
        
        /**
         * Clear all filters
         */
        clearFilters() {
            this.filters = {
                search: '',
                category: null,
                minPrice: null,
                maxPrice: null,
                status: 'active'
            };
        },
        
        /**
         * Set current page
         */
        setPage(page) {
            this.paginatedProducts.page = page;
        },
        
        /**
         * Set page size
         */
        setPageSize(pageSize) {
            this.paginatedProducts.pageSize = pageSize;
        },
        
        /**
         * Clear error message
         */
        clearError() {
            this.error = null;
        },
        
        /**
         * Clear success message
         */
        clearSuccess() {
            this.successMessage = null;
        },
        
        /**
         * Clear both error and success messages
         */
        clearMessages() {
            this.error = null;
            this.successMessage = null;
        },
        
        /**
         * Reset current product
         */
        resetCurrentProduct() {
            this.currentProduct = null;
        }
    }
});