package com.zbox.backend.security;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Component
public class JwtService {

    @Value("${jwt.expiration-seconds}")
    private long expiracaoSegundos;

    @Value("${jwt.secret}")
    private String jwtSecret;

    private SecretKey chaveSecreta;

    @PostConstruct
    public void init() {
        chaveSecreta = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
    }

    public String gerarToken(String usuario) {
        return Jwts.builder()
                .subject(usuario)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expiracaoSegundos * 1000))
                .signWith(chaveSecreta)
                .compact();
    }

    public String extrairUsuario(String token) {
        return Jwts.parser()
                .verifyWith(chaveSecreta)
                .build()
                .parseSignedClaims(token)
                .getPayload()
                .getSubject();
    }

    public long getExpiracaoSegundos() {
        return expiracaoSegundos;
    }
}
