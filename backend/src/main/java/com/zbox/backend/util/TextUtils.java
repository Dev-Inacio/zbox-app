package com.zbox.backend.util;

public class TextUtils {

    public static String blankToNull(String value) {
        if (value == null) {
            return null;
        }
        if (value.trim().isEmpty()) {
            return null;
        }
        return value.trim();
    }
}
