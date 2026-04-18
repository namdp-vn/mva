cmake_minimum_required(VERSION 3.22.1)
project(appmodules)

set(PROJECT_ROOT ${CMAKE_CURRENT_SOURCE_DIR}/../../../../..)
set(SHERPA_ANDROID_DIR ${PROJECT_ROOT}/node_modules/react-native-sherpa-onnx/android)
set(SHERPA_INCLUDE_DIR ${SHERPA_ANDROID_DIR}/src/main/cpp/include)
set(SHERPA_JNILIBS_DIR ${SHERPA_ANDROID_DIR}/src/main/jniLibs/${ANDROID_ABI})

include(${PROJECT_ROOT}/node_modules/react-native/ReactAndroid/cmake-utils/ReactNative-application.cmake)

target_include_directories(${CMAKE_PROJECT_NAME} PRIVATE
    ${SHERPA_INCLUDE_DIR}
)

target_link_directories(${CMAKE_PROJECT_NAME} PRIVATE ${SHERPA_JNILIBS_DIR})
target_sources(${CMAKE_PROJECT_NAME} PRIVATE
    OfflineSpeakerDiarizationModule.cpp
    SpeakerEmbeddingModule.cpp
)

target_link_libraries(${CMAKE_PROJECT_NAME}
    sherpa-onnx-c-api
    log
    android
)