package com.zbox.backend.controller;

import com.zbox.backend.config.JwtUtil;
import com.zbox.backend.dto.AuthUser;
import com.zbox.backend.dto.LoginRequest;
import com.zbox.backend.dto.LoginResponse;
import com.zbox.backend.model.Usuario;
import com.zbox.backend.service.UsuarioService;
import jakarta.validation.Valid;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthenticationManager authenticationManager;

    private final JwtUtil jwtUtil;

    private final UsuarioService usuarioService;

    public AuthController(AuthenticationManager authenticationManager, JwtUtil jwtUtil, UsuarioService usuarioService) {
        this.authenticationManager = authenticationManager;
        this.jwtUtil = jwtUtil;
        this.usuarioService = usuarioService;
    }


    @PostMapping("/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest loginRequest) {
        authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(loginRequest.getEmail(), loginRequest.getPassword()));

        Usuario usuario = usuarioService.buscarPorUsuario(loginRequest.getEmail());

        String token = jwtUtil.gerarToken(usuario.getUsuario());

        AuthUser authUser = new AuthUser(usuario.getId(), usuario.getName(), usuario.getUsuario(), usuario.getRole().name());

        return new LoginResponse(token, "Bearer", jwtUtil.getExpiracaoSegundos(), authUser);
    }
}
