# Project-level CMakeLists.txt for Flutter Windows native desktop application.
cmake_minimum_required(VERSION 3.14)
project(erp_warehouse_mobile LANGUAGES CXX)

set(BINARY_NAME "erp_warehouse_mobile")

cmake_policy(SET CMP0079 NEW)

# Explicitly opt in to modern CMake behaviors to avoid warnings with recent
# versions of CMake.
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Define configuration types.
set(CMAKE_CONFIGURATION_TYPES "Debug;Profile;Release"
  CACHE STRING "" FORCE)

# Build the runner executable.
add_subdirectory("runner")

# Generated plugin build rules, which manages building the plugins and adding
# them to the application.
include(flutter/generated_plugins.cmake OPTIONAL)

