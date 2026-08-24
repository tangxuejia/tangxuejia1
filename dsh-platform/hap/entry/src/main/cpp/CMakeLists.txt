cmake_minimum_required(VERSION 3.16)
project(dsh_hap_bridge)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_library(dsh_hap_bridge SHARED dsh_hap_bridge.cpp)
target_include_directories(dsh_hap_bridge PRIVATE ${CMAKE_CURRENT_SOURCE_DIR})
