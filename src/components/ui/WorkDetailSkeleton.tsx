import React from 'react';

export function WorkDetailSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 animate-pulse">
      {/* Header Skeleton */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Breadcrumb Skeleton */}
          <div className="flex items-center space-x-2 mb-4">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
          </div>
        </div>
      </div>

      {/* Main Content Skeleton */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Cover Skeleton */}
              <div className="lg:col-span-1">
                <div className="aspect-[3/4] w-full max-w-sm mx-auto bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
              </div>

              {/* Details Skeleton */}
              <div className="lg:col-span-2 space-y-6">
                {/* Title and Author Skeleton */}
                <div>
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                  <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                </div>

                {/* Synopsis Skeleton */}
                <div>
                  <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-3"></div>
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                  </div>
                </div>

                {/* Metadata Skeleton */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-1"></div>
                    <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-28"></div>
                  </div>
                  <div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-36 mb-1"></div>
                    <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
                  </div>
                </div>

                {/* Action Buttons Skeleton */}
                <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-lg flex-1"></div>
                    <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-lg flex-1"></div>
                  </div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-80 mt-2"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Information Skeleton */}
        <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-40 mb-4"></div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WorkDetailSkeleton;